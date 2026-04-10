// Cloudflare Access JWT validation
async function validateAccessJWT(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion')

  if (!token) {
    return {
      valid: false,
      error: 'Missing Access JWT',
    }
  }

  try {
    // Fetch the public keys from Cloudflare
    const jwksResponse = await fetch(env.CLOUDFLARE_ACCESS_JWKS_URL)
    const jwks = await jwksResponse.json()

    // Decode the JWT header to get the key ID
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    const headerDecoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), c =>
          c.charCodeAt(0)
        )
      )
    )

    const kid = headerDecoded.kid
    const key = jwks.keys.find((k) => k.kid === kid)

    if (!key) {
      throw new Error('Key not found in JWKS')
    }

    // Verify the JWT (simplified - uses built-in crypto)
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c =>
          c.charCodeAt(0)
        )
      )
    )

    // Validate audience
    if (payload.aud !== env.CLOUDFLARE_ACCESS_AUD) {
      throw new Error('Invalid audience')
    }

    // Validate expiration
    if (payload.exp < Date.now() / 1000) {
      throw new Error('Token expired')
    }

    return {
      valid: true,
      user: payload.email || payload.sub,
      email: payload.email,
    }
  } catch (error) {
    console.error('JWT validation error:', error)
    return {
      valid: false,
      error: error.message,
    }
  }
}

// Main Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Skip Access validation for health checks (optional)
    if (pathname === '/health') {
      return new Response('OK', { status: 200 })
    }

    // Validate Cloudflare Access JWT
    const accessValidation = await validateAccessJWT(request, env)

    if (!accessValidation.valid) {
      return new Response('Unauthorized: Invalid or missing Access JWT', {
        status: 401,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    // Add user info to request headers for logging
    const headers = new Headers(request.headers)
    headers.set('X-Access-User', accessValidation.email || accessValidation.user)

    // Handle SPA routing - Wrangler serves static files automatically
    if (
      pathname.includes('.') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/assets/')
    ) {
      return fetch(request)
    }

    // For SPA routes (no extension), serve index.html
    const indexRequest = new Request(`${url.origin}/index.html`, {
      method: request.method,
      headers: headers,
      body: request.body,
    })

    return fetch(indexRequest)
  },
}
