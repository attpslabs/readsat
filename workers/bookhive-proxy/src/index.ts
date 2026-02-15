/**
 * Cloudflare Worker: BookHive CORS Proxy
 *
 * Proxies GET requests to bookhive.buzz/xrpc/* and adds CORS headers.
 * Only allows requests from approved origins and only forwards to
 * the BookHive XRPC API path.
 */

interface Env {
  BOOKHIVE_ORIGIN: string
}

const ALLOWED_ORIGINS = [
  'https://reads.at',
  'http://localhost:19006',
  'http://localhost:8080',
]

const ALLOWED_PATH_PREFIX = '/xrpc/buzz.bookhive.'

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function isAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  return ALLOWED_ORIGINS.includes(origin) ? origin : null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const allowedOrigin = isAllowedOrigin(origin)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!allowedOrigin) {
        return new Response(null, {status: 403})
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(allowedOrigin),
      })
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {status: 405})
    }

    const url = new URL(request.url)

    // Only allow /xrpc/buzz.bookhive.* paths
    if (!url.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
      return new Response('Forbidden: path not allowed', {status: 403})
    }

    // Forward the request to BookHive
    const targetUrl = `${env.BOOKHIVE_ORIGIN}${url.pathname}${url.search}`
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'reads.at-bookhive-proxy/1.0',
        Accept: 'application/json',
      },
    })

    // Clone response and add CORS headers
    const responseHeaders = new Headers(response.headers)
    if (allowedOrigin) {
      responseHeaders.set('Access-Control-Allow-Origin', allowedOrigin)
    }
    // Remove headers that could cause issues
    responseHeaders.delete('set-cookie')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  },
}
