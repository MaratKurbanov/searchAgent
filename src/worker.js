import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler'

// Cloudflare Access JWT validation
async function validateAccessJWT(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion')

  // Fallback values
  const AUD = env.CLOUDFLARE_ACCESS_AUD || 'f189d9a0e6304c25e2e58f56d530cfb3a4a38ac803608d17c9d39453d6c0beea'
  const JWKS_URL = env.CLOUDFLARE_ACCESS_JWKS_URL || 'https://maratkurbanov.cloudflareaccess.com/cdn-cgi/access/certs'

  console.log('🔐 JWT Validation:', { tokenPresent: !!token })

  if (!token) {
    return {
      valid: false,
      error: 'Missing Access JWT',
    }
  }

  try {
    // Fetch JWKs
    const jwksResponse = await fetch(JWKS_URL)
    if (!jwksResponse.ok) {
      throw new Error(`JWKs fetch failed: ${jwksResponse.status}`)
    }

    const jwks = await jwksResponse.json()

    // Decode JWT
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

    // Decode payload
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c =>
          c.charCodeAt(0)
        )
      )
    )

    // Validate audience (handle comma-separated)
    const audiences = typeof payload.aud === 'string'
      ? payload.aud.split(',').map(a => a.trim())
      : Array.isArray(payload.aud)
      ? payload.aud
      : [payload.aud]

    if (!audiences.includes(AUD)) {
      throw new Error('Invalid audience')
    }

    // Validate expiration
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (payload.exp < nowSeconds) {
      throw new Error('Token expired')
    }

    console.log('✓ JWT valid:', payload.email)
    return {
      valid: true,
      email: payload.email,
    }
  } catch (error) {
    console.error('❌ JWT validation failed:', error.message)
    return {
      valid: false,
      error: error.message,
    }
  }
}

// Main Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const pathname = url.pathname

    console.log(`📨 ${request.method} ${pathname}`)

    // Health check (no auth required)
    if (pathname === '/health') {
      return new Response('OK', { status: 200 })
    }

    // Skip Access validation for localhost
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

    if (!isLocalhost) {
      // Validate JWT on production
      const accessValidation = await validateAccessJWT(request, env)

      if (!accessValidation.valid) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: accessValidation.error,
          }, null, 2),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      console.log(`👤 Authenticated: ${accessValidation.email}`)
    } else {
      console.log('⚠️  Localhost mode - Auth skipped')
    }

    // Serve static assets from KV
    try {
      console.log('📦 Serving from KV...')

      // Map request to asset
      const mappedRequest = mapRequestToAsset(request)
      console.log('📍 Mapped path:', new URL(mappedRequest.url).pathname)

      // Get from KV
      const response = await getAssetFromKV(
        {
          request: mappedRequest,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          cacheControl: {
            default: '1h',
            'max-age': 3600,
          },
        }
      )

      // Set cache headers for HTML
      if (pathname.endsWith('.html') || pathname === '/') {
        const newHeaders = new Headers(response.headers)
        newHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate')
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        })
      }

      return response
    } catch (error) {
      console.error('❌ Asset error:', error.message)
      console.error('📋 Error type:', error.constructor.name)

      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: error.message,
          path: pathname,
        }, null, 2),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  },
}
