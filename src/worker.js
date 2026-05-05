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
      return new Response(`window.API_URL=${JSON.stringify(apiUrl)};`, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=0, must-revalidate' },
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
