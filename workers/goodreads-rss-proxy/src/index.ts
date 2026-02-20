/**
 * Cloudflare Worker: Goodreads RSS Proxy
 *
 * Fetches Goodreads RSS feeds, parses XML to JSON, and returns
 * normalized book data with CORS headers.
 *
 * Routes:
 *   GET  /rss?userId={id}&shelf={shelf}  — fetch and parse a shelf RSS feed
 *   POST /report-missing                 — send unmatched books to Discord webhook
 */

import {XMLParser} from 'fast-xml-parser'

interface Env {
  DISCORD_MISSING_BOOKS_WEBHOOK_URL: string
}

export interface GoodreadsRssBook {
  goodreadsId: string
  title: string
  author: string
  isbn: string
  rating: number
  imageUrl: string
  shelf: string
  dateAdded: string
  dateRead: string
}

const ALLOWED_ORIGINS = [
  'https://reads.at',
  'http://localhost:19006',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
]

const VALID_SHELVES = ['currently-reading', 'read', 'to-read']

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function isAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  return ALLOWED_ORIGINS.includes(origin) ? origin : null
}

function jsonResponse(
  data: unknown,
  status: number,
  origin: string | null,
): Response {
  const headers: HeadersInit = {'Content-Type': 'application/json'}
  if (origin) Object.assign(headers, corsHeaders(origin))
  return new Response(JSON.stringify(data), {status, headers})
}

function parseRssItems(xml: string): GoodreadsRssBook[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
  })
  const result = parser.parse(xml)

  const channel = result?.rss?.channel
  if (!channel) return []

  let items = channel.item
  if (!items) return []
  if (!Array.isArray(items)) items = [items]

  return items.map((item: Record<string, string>) => ({
    goodreadsId: String(item.book_id ?? ''),
    title: cleanHtml(String(item.title ?? '')),
    author: cleanHtml(String(item.author_name ?? '')),
    isbn: String(item.isbn ?? ''),
    rating: parseInt(String(item.user_rating ?? '0'), 10),
    imageUrl: String(item.book_large_image_url ?? item.book_image_url ?? ''),
    shelf: String(item.user_shelves ?? ''),
    dateAdded: String(item.user_date_added ?? ''),
    dateRead: String(item.user_read_at ?? ''),
  }))
}

function cleanHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

async function handleRss(url: URL, origin: string | null): Promise<Response> {
  const userId = url.searchParams.get('userId')
  const shelf = url.searchParams.get('shelf')

  if (!userId || !/^\d+$/.test(userId)) {
    return jsonResponse(
      {error: 'userId is required and must be numeric'},
      400,
      origin,
    )
  }

  if (shelf && !VALID_SHELVES.includes(shelf)) {
    return jsonResponse(
      {error: `shelf must be one of: ${VALID_SHELVES.join(', ')}`},
      400,
      origin,
    )
  }

  const rssUrl = shelf
    ? `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}`
    : `https://www.goodreads.com/review/list_rss/${userId}`

  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'reads.at-goodreads-rss-proxy/1.0',
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
  })

  if (!response.ok) {
    return jsonResponse(
      {error: `Goodreads returned ${response.status}`},
      response.status === 404 ? 404 : 502,
      origin,
    )
  }

  const xml = await response.text()
  const books = parseRssItems(xml)

  return jsonResponse({books}, 200, origin)
}

async function handleReportMissing(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const body = await request.json()

  if (!body.books || !Array.isArray(body.books) || body.books.length === 0) {
    return jsonResponse({error: 'books array is required'}, 400, origin)
  }

  if (!env.DISCORD_MISSING_BOOKS_WEBHOOK_URL) {
    // No webhook configured, just acknowledge
    return jsonResponse({ok: true, sent: false}, 200, origin)
  }

  const bookList = body.books
    .slice(0, 25) // Limit to 25 books per report
    .map(b => `- **${b.title}** by ${b.author} (GR ID: ${b.goodreadsId})`)
    .join('\n')

  const message = {
    content: `**Missing books report${body.userHandle ? ` from @${body.userHandle}` : ''}**\n${body.books.length} book(s) not found in BookHive catalog:\n${bookList}`,
  }

  await fetch(env.DISCORD_MISSING_BOOKS_WEBHOOK_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(message),
  })

  return jsonResponse({ok: true, sent: true}, 200, origin)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const allowedOrigin = isAllowedOrigin(origin)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (!allowedOrigin) return new Response(null, {status: 403})
      return new Response(null, {
        status: 204,
        headers: corsHeaders(allowedOrigin),
      })
    }

    const url = new URL(request.url)

    try {
      if (url.pathname === '/rss' && request.method === 'GET') {
        return handleRss(url, allowedOrigin)
      }

      if (url.pathname === '/report-missing' && request.method === 'POST') {
        return handleReportMissing(request, env, allowedOrigin)
      }

      return jsonResponse({error: 'Not found'}, 404, allowedOrigin)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return jsonResponse({error: message}, 500, allowedOrigin)
    }
  },
}
