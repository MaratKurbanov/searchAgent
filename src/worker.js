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

    // RAG + OpenAI proxy — 3 steps: query extraction → retrieval → generation
    if (pathname === '/api/chat/completions' && request.method === 'POST') {
      if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        })
      }

      const { messages, stream } = await request.json()
      const model = env.OPENAI_MODEL || 'gpt-4o'
      const authHeader = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` }

      // Step 1: ask the LLM to extract the best search query for the vector database
      let searchQuery = messages.at(-1)?.content ?? ''
      try {
        const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            model,
            stream: false,
            messages: [
              {
                role: 'system',
                content: 'From the conversation below, extract a concise search query optimized for semantic vector search. Focus on the factual subject matter — strip out conversational filler, pronouns, and follow-up phrasing. Return only the search query text, nothing else.',
              },
              ...messages,
            ],
          }),
        })
        if (extractRes.ok) {
          const data = await extractRes.json()
          searchQuery = data.choices?.[0]?.message?.content?.trim() || searchQuery
        }
      } catch (_) { /* fall back to raw last message */ }

      // Step 2: retrieve relevant chunks from the AI Search index using the optimized query
      let context = ''
      if (env.API_URL) {
        try {
          const searchRes = await fetch(`${env.API_URL.replace(/\/$/, '')}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: searchQuery }] }),
          })
          const searchBody = await searchRes.text()
          if (searchRes.ok) {
            const parsed = JSON.parse(searchBody)
            // handle both response shapes: new {chunks:[]} and old {data:[{content:[{text}]}]}
            const chunks = parsed.chunks ?? parsed.data ?? []
            context = chunks.map(c => {
              const text = c.text ?? c.content?.[0]?.text ?? ''
              const title = c.item?.key ?? c.filename ?? ''
              const url = c.attributes?.url ?? c.item?.attributes?.url ?? ''
              const header = [title && `Title: ${title}`, url && `URL: ${url}`].filter(Boolean).join(' | ')
              return header ? `[${header}]\n${text}` : text
            }).filter(c => c.trim()).join('\n\n---\n\n')
          } else {
            console.error(`AI Search /search failed: ${searchRes.status}`, searchBody)
          }
        } catch (e) {
          console.error('AI Search /search error:', e.message)
        }
      }

      // Step 3: generate the answer using the retrieved context + full conversation
      const systemParts = []
      if (env.SYSTEM_PROMPT) systemParts.push(env.SYSTEM_PROMPT)
      if (context) systemParts.push(`Use the following source material to answer the user's question. Cite relevant parts. If the answer isn't in the sources, say so rather than guessing.\n\n${context}`)

      const enrichedMessages = systemParts.length
        ? [{ role: 'system', content: systemParts.join('\n\n') }, ...messages]
        : messages

      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ model, messages: enrichedMessages, stream }),
      })

      return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream' },
      })
    }

    // Skip auth on localhost
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
