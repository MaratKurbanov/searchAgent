// No imports needed - using modern env.ASSETS binding

// Cloudflare Access JWT validation
async function validateAccessJWT(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion')

  const AUD = env.CLOUDFLARE_ACCESS_AUD || 'f189d9a0e6304c25e2e58f56d530cfb3a4a38ac803608d17c9d39453d6c0beea'
  const JWKS_URL = env.CLOUDFLARE_ACCESS_JWKS_URL || 'https://maratkurbanov.cloudflareaccess.com/cdn-cgi/access/certs'

  if (!token) {
    return { valid: false, error: 'Missing Access JWT' }
  }

  try {
    const jwksResponse = await fetch(JWKS_URL)
    if (!jwksResponse.ok) throw new Error(`JWKs fetch failed: ${jwksResponse.status}`)

    const jwks = await jwksResponse.json()
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid JWT format')

    const headerDecoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
      )
    )

    const kid = headerDecoded.kid
    const key = jwks.keys.find((k) => k.kid === kid)
    if (!key) throw new Error('Key not found in JWKS')

    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
      )
    )

    // Handle comma-separated audiences
    const audiences = typeof payload.aud === 'string'
      ? payload.aud.split(',').map(a => a.trim())
      : Array.isArray(payload.aud) ? payload.aud : [payload.aud]

    if (!audiences.includes(AUD)) throw new Error('Invalid audience')

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (payload.exp < nowSeconds) throw new Error('Token expired')

    return { valid: true, email: payload.email }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Health check
    if (pathname === '/health') {
      return new Response('OK', { status: 200 })
    }

    // Runtime config — must be before auth so the browser can load it via <script>
    if (pathname === '/config.js') {
      const apiUrl = env.API_URL || ''
      const siteName = env.SITE_NAME || ''
      return new Response(`window.API_URL=${JSON.stringify(apiUrl)};window.SITE_NAME=${JSON.stringify(siteName)};`, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
      })
    }

    // Auth — skip on localhost, validate Cloudflare Access JWT everywhere else
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (!isLocalhost) {
      const accessValidation = await validateAccessJWT(request, env)
      if (!accessValidation.valid) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: accessValidation.error }, null, 2),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // RAG + OpenAI proxy — 3 steps: query extraction → retrieval → generation
    if (pathname === '/api/chat/completions' && request.method === 'POST') {
      if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        })
      }

      const { messages, stream, rewrite_query = false, ai_search_options = {} } = await request.json()
      const model = env.OPENAI_MODEL || 'gpt-4o'
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
        // console.log('[LLM → query-gen] sent:', JSON.stringify(queryGenPayload))
        const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify(queryGenPayload),
        })
        if (extractRes.ok) {
          const data = await extractRes.json()
          // console.log('[LLM ← query-gen] received:', JSON.stringify(data))
          const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
          if (Array.isArray(parsed.queries) && parsed.queries.length) {
            searchQueries = parsed.queries
          }
        }
      } catch (_) { /* fall back to raw last message */ }

      // Step 2: run all search queries in parallel, deduplicate chunks by url/title
      let context = ''
      if (env.API_URL) {
        try {
          const searchUrl = `${env.API_URL.replace(/\/$/, '')}/search`
          const results = await Promise.all(
            searchQueries.map(q => {
              const searchBody = { messages: [{ role: 'user', content: q }], stream: false, rewrite_query, ai_search_options }
              // console.log(`[RAG → search] query: ${JSON.stringify(q)} | body:`, JSON.stringify(searchBody))
              return fetch(searchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'cf-ai-search-source': 'snippet-search' },
                body: JSON.stringify(searchBody),
              })
                .then(r => r.ok ? r.json() : r.text().then(t => { /* console.error(`AI Search failed: ${r.status}`, t); */ return {} }))
                .then(data => { /* console.log(`[RAG ← search] query: ${JSON.stringify(q)} | response:`, JSON.stringify(data)); */ return data })
                .catch(e => { /* console.error('AI Search error:', e.message); */ return {} })
            })
          )

          const seen = new Set()
          const chunks = results.flatMap(r => r.result?.chunks ?? r.chunks ?? r.data ?? []).filter(c => {
            const text = c.text ?? c.content?.[0]?.text ?? ''
            if (!text.trim() || seen.has(text)) return false
            seen.add(text)
            return true
          })

          context = chunks.map(c => {
            const text = c.text ?? c.content?.[0]?.text ?? ''
            const title = c.item?.key ?? c.filename ?? ''
            const slug = (c.item?.key ?? c.filename ?? '').replace(/__chunk_\d+\.txt$/, '').replace(/\.txt$/, '')
            const url = c.attributes?.url ?? c.item?.attributes?.url ?? c.item?.metadata?.url
                     ?? (env.SERMON_BASE_URL && slug ? `${env.SERMON_BASE_URL}${slug}/` : '')
            const header = [title && `Title: ${title}`, url && `URL: ${url}`].filter(Boolean).join(' | ')
            return header ? `[${header}]\n${text}` : text
          }).join('\n\n---\n\n')
          // console.log(`[RAG] ${chunks.length} deduplicated chunks across ${searchQueries.length} queries`)
          // console.log('[RAG] context:\n', context)
        } catch (e) {
          // console.error('AI Search error:', e.message)
        }
      }

      // Step 3: generate the answer using the retrieved context + full conversation
      // Guard: if RAG returned nothing, don't call the LLM — it will hallucinate citations.
      if (!context) {
        // console.log('[answer] no RAG context — returning no-results response without calling LLM')
        const noResultsBody = JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'I couldn\'t find any relevant sermons in the library for that question.' } }],
        })
        if (stream) {
          const sseBody = `data: ${JSON.stringify({ choices: [{ delta: { content: 'I couldn\'t find any relevant sermons in the library for that question.' } }] })}\n\ndata: [DONE]\n\n`
          return new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
        }
        return new Response(noResultsBody, { headers: { 'Content-Type': 'application/json' } })
      }

      // env.SYSTEM_PROMPT is passed verbatim — no LLM touches it before this point
      const systemParts = []
      if (env.SYSTEM_PROMPT) systemParts.push(env.SYSTEM_PROMPT)
      if (context) systemParts.push(`Use the following source material to answer the user's question. Cite relevant parts. If the answer isn't in the sources, say so rather than guessing.\n\n${context}`)

      const enrichedMessages = systemParts.length
        ? [{ role: 'system', content: systemParts.join('\n\n') }, ...messages]
        : messages

      const answerPayload = { model, messages: enrichedMessages, stream }
      // console.log('[LLM → answer] sent:', JSON.stringify(answerPayload))
      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(answerPayload),
      })

      if (!stream) {
        const data = await upstream.json()
        // console.log('[LLM ← answer] received:', JSON.stringify(data))
        return new Response(JSON.stringify(data), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // console.log('[LLM ← answer] streaming response started, status:', upstream.status)
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream' },
      })
    }

    // Serve static assets using modern env.ASSETS binding
    let response = await env.ASSETS.fetch(request)

    // For SPA: if asset not found and not a root path, try index.html
    if (response.status === 404 && pathname !== '/' && !pathname.startsWith('/api')) {
      response = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request))
    }

    // Set cache headers for HTML
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('text/html') || pathname === '/' || pathname.endsWith('.html')) {
      const newHeaders = new Headers(response.headers)
      newHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders })
    }

    return response
  },
}
