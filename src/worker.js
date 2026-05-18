// No imports needed - using modern env.ASSETS binding

const ADMIN_EMAIL = 'maratkurbanov@gmail.com'

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getUserEmail(request, isLocalhost) {
  if (isLocalhost) return 'dev@localhost.dev'
  return request.headers.get('Cf-Access-Authenticated-User-Email') || null
}

async function ensureUser(db, email) {
  const isAdmin = email === ADMIN_EMAIL || email === 'dev@localhost.dev'
  const role = isAdmin ? 'admin' : 'user'
  await db.prepare('INSERT OR IGNORE INTO users (email, role) VALUES (?, ?)').bind(email, role).run()
  // Always enforce admin role for privileged emails (handles pre-existing user records with wrong role)
  if (isAdmin) {
    await db.prepare('UPDATE users SET role = ? WHERE email = ? AND role != ?').bind('admin', email, 'admin').run()
  }
  return db.prepare('SELECT email, full_name, role, created_at FROM users WHERE email = ?').bind(email).first()
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (pathname === '/health') return new Response('OK', { status: 200 })

    // Runtime config — must be before auth so the browser can load it via <script>
    if (pathname === '/config.js') {
      const apiUrl = env.API_URL || ''
      const siteName = env.SITE_NAME || ''
      return new Response(
        `window.API_URL=${JSON.stringify(apiUrl)};window.SITE_NAME=${JSON.stringify(siteName)};`,
        { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } }
      )
    }

    // Auth — Cloudflare Access validates the JWT at the edge and injects this header.
    // Cloudflare strips any client-supplied cf-access-* headers, so its presence is trustworthy.
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (!isLocalhost && !request.headers.get('Cf-Access-Authenticated-User-Email')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }, null, 2),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── User API ──────────────────────────────────────────────────────────────

    if (pathname === '/api/me') {
      if (!env.DB) return jsonResp({ error: 'Database not configured' }, 503)
      const email = getUserEmail(request, isLocalhost)
      if (request.method === 'GET') {
        const user = await ensureUser(env.DB, email)
        return jsonResp(user)
      }
      if (request.method === 'POST') {
        const { full_name } = await request.json()
        await env.DB.prepare('UPDATE users SET full_name = ? WHERE email = ?')
          .bind(full_name || null, email).run()
        const user = await env.DB.prepare(
          'SELECT email, full_name, role, created_at FROM users WHERE email = ?'
        ).bind(email).first()
        return jsonResp(user)
      }
    }

    // ── Bookmark APIs ─────────────────────────────────────────────────────────

    if (pathname === '/api/bookmarks') {
      if (!env.DB) return jsonResp({ error: 'Database not configured' }, 503)
      const email = getUserEmail(request, isLocalhost)
      await ensureUser(env.DB, email)

      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM bookmarks WHERE user_email = ? ORDER BY created_at DESC'
        ).bind(email).all()
        return jsonResp(results)
      }

      if (request.method === 'POST') {
        const { sermon_file, sermon_title, sermon_url } = await request.json()
        const id = crypto.randomUUID()
        // INSERT OR IGNORE handles the case where user bookmarks the same sermon twice
        await env.DB.prepare(
          'INSERT OR IGNORE INTO bookmarks (id, user_email, sermon_file, sermon_title, sermon_url) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, email, sermon_file, sermon_title, sermon_url || null).run()
        const bookmark = await env.DB.prepare(
          'SELECT * FROM bookmarks WHERE user_email = ? AND sermon_file = ?'
        ).bind(email, sermon_file).first()
        return jsonResp(bookmark, 201)
      }
    }

    if (pathname === '/api/bookmarks/clear-read' && request.method === 'POST') {
      if (!env.DB) return jsonResp({ error: 'Database not configured' }, 503)
      const email = getUserEmail(request, isLocalhost)
      const result = await env.DB.prepare(
        'DELETE FROM bookmarks WHERE user_email = ? AND is_read = 1'
      ).bind(email).run()
      return jsonResp({ deleted: result.meta.changes })
    }

    const bmMatch = pathname.match(/^\/api\/bookmarks\/([^/]+)$/)
    if (bmMatch) {
      if (!env.DB) return jsonResp({ error: 'Database not configured' }, 503)
      const email = getUserEmail(request, isLocalhost)
      const id = bmMatch[1]

      if (request.method === 'PATCH') {
        const current = await env.DB.prepare(
          'SELECT is_read FROM bookmarks WHERE id = ? AND user_email = ?'
        ).bind(id, email).first()
        if (!current) return jsonResp({ error: 'Not found' }, 404)
        const newIsRead = current.is_read ? 0 : 1
        const readAt = newIsRead ? Math.floor(Date.now() / 1000) : null
        await env.DB.prepare(
          'UPDATE bookmarks SET is_read = ?, read_at = ? WHERE id = ? AND user_email = ?'
        ).bind(newIsRead, readAt, id, email).run()
        return jsonResp({ id, is_read: newIsRead, read_at: readAt })
      }

      if (request.method === 'DELETE') {
        await env.DB.prepare(
          'DELETE FROM bookmarks WHERE id = ? AND user_email = ?'
        ).bind(id, email).run()
        return jsonResp({ success: true })
      }
    }

    // ── Notes API ─────────────────────────────────────────────────────────────

    if (pathname === '/api/notes') {
      if (!env.DB) return jsonResp({ error: 'Database not configured' }, 503)
      const email = getUserEmail(request, isLocalhost)
      await ensureUser(env.DB, email)

      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT sermon_slug, sermon_title, updated_at FROM notes WHERE user_email = ? ORDER BY updated_at DESC'
        ).bind(email).all()
        return jsonResp(results)
      }
    }

    const noteMatch = pathname.match(/^\/api\/notes\/([^/]+)$/)
    if (noteMatch) {
      if (!env.DB) return jsonResp({ error: 'Database not configured' }, 503)
      const email = getUserEmail(request, isLocalhost)
      await ensureUser(env.DB, email)
      const slug = decodeURIComponent(noteMatch[1])

      if (request.method === 'GET') {
        const note = await env.DB.prepare(
          'SELECT * FROM notes WHERE user_email = ? AND sermon_slug = ?'
        ).bind(email, slug).first()
        if (!note) return jsonResp(null, 404)
        return jsonResp(note)
      }

      if (request.method === 'PUT') {
        const { content, sermon_title } = await request.json()
        const now = Math.floor(Date.now() / 1000)
        await env.DB.prepare(
          `INSERT INTO notes (user_email, sermon_slug, sermon_title, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_email, sermon_slug) DO UPDATE SET
             content = excluded.content,
             sermon_title = excluded.sermon_title,
             updated_at = excluded.updated_at`
        ).bind(email, slug, sermon_title, content, now, now).run()
        const note = await env.DB.prepare(
          'SELECT sermon_slug, sermon_title, updated_at FROM notes WHERE user_email = ? AND sermon_slug = ?'
        ).bind(email, slug).first()
        return jsonResp(note)
      }

      if (request.method === 'DELETE') {
        await env.DB.prepare(
          'DELETE FROM notes WHERE user_email = ? AND sermon_slug = ?'
        ).bind(email, slug).run()
        return jsonResp({ success: true })
      }
    }

    // ── Admin APIs ────────────────────────────────────────────────────────────

    if (pathname.startsWith('/api/admin/')) {
      if (!env.DB) return jsonResp({ error: 'Database not configured' }, 503)
      const email = getUserEmail(request, isLocalhost)
      const caller = await env.DB.prepare(
        'SELECT role FROM users WHERE email = ?'
      ).bind(email).first()
      if (caller?.role !== 'admin') return jsonResp({ error: 'Forbidden' }, 403)

      if (pathname === '/api/admin/users' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT u.email, u.full_name, u.role, u.created_at,
                  COUNT(b.id) AS bookmark_count,
                  COALESCE(SUM(b.is_read), 0) AS read_count
           FROM users u LEFT JOIN bookmarks b ON u.email = b.user_email
           GROUP BY u.email ORDER BY u.created_at DESC`
        ).all()
        return jsonResp(results)
      }

      const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
      if (adminUserMatch) {
        const targetEmail = decodeURIComponent(adminUserMatch[1])

        if (request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT * FROM bookmarks WHERE user_email = ? ORDER BY created_at DESC'
          ).bind(targetEmail).all()
          return jsonResp(results)
        }

        if (request.method === 'PATCH') {
          const body = await request.json()
          const updates = []
          const values = []
          if (body.role !== undefined) { updates.push('role = ?'); values.push(body.role) }
          if (body.full_name !== undefined) { updates.push('full_name = ?'); values.push(body.full_name) }
          if (updates.length) {
            await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE email = ?`)
              .bind(...values, targetEmail).run()
          }
          const user = await env.DB.prepare(
            'SELECT email, full_name, role, created_at FROM users WHERE email = ?'
          ).bind(targetEmail).first()
          return jsonResp(user)
        }

        if (request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(targetEmail).run()
          return jsonResp({ success: true })
        }
      }
    }

    // ── RAG + OpenAI proxy ────────────────────────────────────────────────────

    if (pathname === '/api/chat/completions' && request.method === 'POST') {
      if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        })
      }

      const { messages, stream, rewrite_query = false, ai_search_options = {} } = await request.json()
      const model = env.OPENAI_MODEL || 'gpt-5.4-2026-03-05'
      const authHeader = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` }

      // Step 1: generate multiple search queries from different angles for better recall
      const fallbackQuery = messages.at(-1)?.content ?? ''
      let searchQueries = [fallbackQuery]
      try {
        const queryGenPayload = {
          model,
          stream: false,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Generate 3 diverse search queries for a semantic vector database based on the user\'s question. Use different phrasings, synonyms, and angles (e.g. theological terms, plain language, related concepts) to maximize recall. Return JSON: {"queries": ["...", "...", "..."]}',
            },
            ...messages,
          ],
        }
        const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify(queryGenPayload),
        })
        if (extractRes.ok) {
          const data = await extractRes.json()
          const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
          if (Array.isArray(parsed.queries) && parsed.queries.length) {
            searchQueries = parsed.queries
          }
        }
      } catch (_) { /* fall back to raw last message */ }

      // Step 2: run all search queries in parallel, deduplicate chunks by content
      let context = ''
      let chunkCount = 0
      if (env.API_URL) {
        try {
          const searchUrl = `${env.API_URL.replace(/\/$/, '')}/search`
          const results = await Promise.all(
            searchQueries.map(q => {
              const searchBody = { messages: [{ role: 'user', content: q }], stream: false, rewrite_query, ai_search_options }
              return fetch(searchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'cf-ai-search-source': 'snippet-search' },
                body: JSON.stringify(searchBody),
              })
                .then(r => r.ok ? r.json() : r.text().then(() => ({})))
                .catch(() => ({}))
            })
          )

          const seen = new Set()
          const chunks = results.flatMap(r => r.result?.chunks ?? r.chunks ?? r.data ?? []).filter(c => {
            const text = c.text ?? c.content?.[0]?.text ?? ''
            if (!text.trim() || seen.has(text)) return false
            seen.add(text)
            return true
          })
          chunkCount = chunks.length

          context = chunks.map(c => {
            const text = c.text ?? c.content?.[0]?.text ?? ''
            const titleMatch = text.match(/^TITLE:\s*(.+?)(?:\s+(?:SCRIPTURE|TOPICS|SERIES|URL):)/)
            const slug = (c.item?.key ?? c.filename ?? '').replace(/__chunk_\d+\.txt$/, '').replace(/\.txt$/, '')
            const title = titleMatch?.[1]?.trim() || slug.replace(/-/g, ' ')
            const url = c.attributes?.url ?? c.item?.attributes?.url ?? c.item?.metadata?.url
                     ?? (env.SERMON_BASE_URL && slug ? `${env.SERMON_BASE_URL}${slug}/` : '')
            const header = [title && `Title: ${title}`, url && `URL: ${url}`].filter(Boolean).join(' | ')
            return header ? `[${header}]\n${text}` : text
          }).join('\n\n---\n\n')
        } catch (_) { /* proceed without context */ }
      }

      // Step 3: guard — if RAG returned nothing, don't call the LLM
      if (!context) {
        const msg = 'I couldn\'t find any relevant sermons in the library for that question.'
        if (stream) {
          const sseBody = `data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\ndata: [DONE]\n\n`
          return new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
        }
        return new Response(
          JSON.stringify({ choices: [{ message: { role: 'assistant', content: msg } }] }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      const systemParts = []
      if (env.SYSTEM_PROMPT) systemParts.push(env.SYSTEM_PROMPT)
      systemParts.push(`Use the following source material to answer the user's question. Cite relevant parts. If the answer isn't in the sources, say so rather than guessing.\n\n${context}`)

      const enrichedMessages = [{ role: 'system', content: systemParts.join('\n\n') }, ...messages]
      const answerPayload = { model, messages: enrichedMessages, stream }
      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(answerPayload),
      })

      if (!stream) {
        const data = await upstream.json()
        return new Response(JSON.stringify(data), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const metaEvent = new TextEncoder().encode(
        `data: ${JSON.stringify({ type: 'rag_meta', chunk_count: chunkCount })}\n\n`
      )
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      ctx.waitUntil((async () => {
        await writer.write(metaEvent)
        const reader = upstream.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
        await writer.close()
      })())
      return new Response(readable, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream' },
      })
    }

    // ── Static assets ─────────────────────────────────────────────────────────

    let response = await env.ASSETS.fetch(request)
    if (response.status === 404 && pathname !== '/' && !pathname.startsWith('/api')) {
      response = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request))
    }

    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('text/html') || pathname === '/' || pathname.endsWith('.html')) {
      const newHeaders = new Headers(response.headers)
      newHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders })
    }

    return response
  },
}
