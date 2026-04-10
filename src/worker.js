import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler'

// Cloudflare Access JWT validation with debugging
async function validateAccessJWT(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion')

  console.log('=== Cloudflare Access JWT Validation Debug ===')
  console.log('Token present:', !!token)
  console.log('Environment AUD:', env.CLOUDFLARE_ACCESS_AUD)
  console.log('Environment JWKS URL:', env.CLOUDFLARE_ACCESS_JWKS_URL)

  if (!token) {
    console.log('ERROR: No Cf-Access-Jwt-Assertion header found')
    return {
      valid: false,
      error: 'Missing Access JWT - ensure Access is enabled for this domain',
      debug: {
        headerPresent: false,
        availableHeaders: Array.from(request.headers.entries()).map(([k]) => k),
      },
    }
  }

  try {
    console.log('Token received, attempting validation...')

    // Fetch the public keys from Cloudflare
    console.log('Fetching JWKs from:', env.CLOUDFLARE_ACCESS_JWKS_URL)
    const jwksResponse = await fetch(env.CLOUDFLARE_ACCESS_JWKS_URL)

    if (!jwksResponse.ok) {
      throw new Error(`Failed to fetch JWKs: ${jwksResponse.status} ${jwksResponse.statusText}`)
    }

    const jwks = await jwksResponse.json()
    console.log('JWKs fetched successfully, keys count:', jwks.keys?.length || 0)

    // Decode the JWT header to get the key ID
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format: expected 3 parts')
    }

    console.log('JWT has 3 parts, attempting decode...')

    const headerDecoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), c =>
          c.charCodeAt(0)
        )
      )
    )

    console.log('JWT Header decoded:', { typ: headerDecoded.typ, alg: headerDecoded.alg, kid: headerDecoded.kid })

    const kid = headerDecoded.kid
    const key = jwks.keys.find((k) => k.kid === kid)

    if (!key) {
      console.log('ERROR: Key ID not found in JWKS')
      console.log('Looking for kid:', kid)
      console.log('Available kids:', jwks.keys.map(k => k.kid))
      throw new Error('Key not found in JWKS')
    }

    console.log('Key found, decoding payload...')

    // Decode payload
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c =>
          c.charCodeAt(0)
        )
      )
    )

    console.log('Payload decoded:', {
      email: payload.email,
      sub: payload.sub,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
    })

    // Validate audience
    if (payload.aud !== env.CLOUDFLARE_ACCESS_AUD) {
      console.log('ERROR: Audience mismatch')
      console.log('Expected:', env.CLOUDFLARE_ACCESS_AUD)
      console.log('Got:', payload.aud)
      throw new Error('Invalid audience')
    }

    // Validate expiration
    const nowSeconds = Math.floor(Date.now() / 1000)
    console.log('Checking expiration: exp=' + payload.exp + ', now=' + nowSeconds)

    if (payload.exp < nowSeconds) {
      console.log('ERROR: Token expired')
      throw new Error('Token expired')
    }

    console.log('✓ JWT validation successful')
    return {
      valid: true,
      user: payload.email || payload.sub,
      email: payload.email,
    }
  } catch (error) {
    console.error('JWT validation error:', error.message)
    console.error('Error stack:', error.stack)
    return {
      valid: false,
      error: error.message,
      debug: {
        tokenPresent: !!token,
        tokenLength: token?.length,
      },
    }
  }
}

// Main Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const pathname = url.pathname

    console.log(`${request.method} ${pathname}`)

    // Skip Access validation for health checks
    if (pathname === '/health') {
      return new Response('OK', { status: 200 })
    }

    // Validate Cloudflare Access JWT
    const accessValidation = await validateAccessJWT(request, env)

    if (!accessValidation.valid) {
      console.log('Access validation failed:', accessValidation.error)
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: accessValidation.error,
          debug: accessValidation.debug,
        }, null, 2),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    console.log(`Access granted for user: ${accessValidation.email}`)

    // Add user info to request headers
    const headers = new Headers(request.headers)
    headers.set('X-Access-User', accessValidation.email || accessValidation.user)

    // Serve static assets from KV
    try {
      // Map request to asset (handles SPA routing)
      const mappedRequest = mapRequestToAsset(request)

      // Get asset from KV
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
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
        }
      )

      // Cache control for HTML (no cache, must revalidate)
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
      console.error('Asset serving error:', error)
      return new Response('Not found', { status: 404 })
    }
  },
}
