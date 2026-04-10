// Worker handles SPA routing - Wrangler serves static files automatically
export default {
  async fetch(request) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // For API-like paths or file extensions, let Wrangler's static handler serve them
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
      headers: request.headers,
      body: request.body,
    })

    return fetch(indexRequest)
  },
}
