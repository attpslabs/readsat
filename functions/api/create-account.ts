const ALLOWED_ORIGINS = [
  'https://reads.at',
  'http://localhost:19006',
  'http://localhost:8080',
]

const HANDLE_SUFFIX = '.self.surf'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9]([a-z0-9-]{1,18}[a-z0-9])?$/

const PDS_ERROR_MESSAGES: Record<string, string> = {
  HandleNotAvailable: 'That handle is already taken. Please choose another.',
  InvalidHandle: 'The handle you entered is not valid.',
  InvalidEmail: 'The email address you entered is not valid.',
  EmailNotAvailable: 'An account with that email address already exists.',
  InvalidPassword: 'The password you entered does not meet requirements.',
  RateLimitExceeded: 'Too many attempts. Please wait a moment and try again.',
}

interface Env {
  APP_SHARED_SECRET: string
}

function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin')
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin
  }

  const referer = request.headers.get('Referer')
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin
      if (ALLOWED_ORIGINS.includes(refererOrigin)) {
        return refererOrigin
      }
    } catch {
      // invalid Referer URL
    }
  }

  return null
}

function corsHeaders(origin: string): Record<string, string> {
  return {'Access-Control-Allow-Origin': origin}
}

function jsonResponse(
  body: object,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? corsHeaders(origin) : {}),
    },
  })
}

function validateBody(
  body: unknown,
):
  | {valid: true; data: {email: string; handle: string; password: string}}
  | {valid: false; error: string} {
  if (typeof body !== 'object' || body === null) {
    return {valid: false, error: 'Invalid request body'}
  }

  const {email, handle, password} = body as Record<string, unknown>

  if (!email || typeof email !== 'string') {
    return {valid: false, error: 'Missing required field: email'}
  }
  if (!EMAIL_RE.test(email)) {
    return {valid: false, error: 'Invalid email address'}
  }

  if (!handle || typeof handle !== 'string') {
    return {valid: false, error: 'Missing required field: handle'}
  }
  if (!handle.endsWith(HANDLE_SUFFIX)) {
    return {valid: false, error: `Handle must end with ${HANDLE_SUFFIX}`}
  }
  const username = handle.slice(0, -HANDLE_SUFFIX.length).toLowerCase()
  if (!USERNAME_RE.test(username)) {
    return {
      valid: false,
      error:
        'Handle must be 3-20 characters, using only lowercase letters, numbers, and hyphens',
    }
  }

  if (!password || typeof password !== 'string') {
    return {valid: false, error: 'Missing required field: password'}
  }
  if (password.length < 8) {
    return {valid: false, error: 'Password must be at least 8 characters'}
  }

  return {
    valid: true,
    data: {
      email,
      handle: username + HANDLE_SUFFIX,
      password,
    },
  }
}

export const onRequestOptions: PagesFunction<Env> = async context => {
  const origin = getAllowedOrigin(context.request)
  if (!origin) {
    return new Response(null, {status: 403})
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export const onRequestPost: PagesFunction<Env> = async context => {
  const {request, env} = context

  // 1. Origin validation
  const origin = getAllowedOrigin(request)
  if (!origin) {
    return jsonResponse({error: 'Forbidden'}, 403, null)
  }

  // 2. Server config check
  if (!env.APP_SHARED_SECRET) {
    return jsonResponse({error: 'Server configuration error'}, 500, origin)
  }

  // 3. Content-Type check
  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) {
    return jsonResponse(
      {error: 'Content-Type must be application/json'},
      400,
      origin,
    )
  }

  // 4. Parse JSON body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return jsonResponse({error: 'Invalid JSON body'}, 400, origin)
  }

  // 5. Validate fields
  const validation = validateBody(rawBody)
  if (!validation.valid) {
    return jsonResponse({error: validation.error}, 400, origin)
  }
  const {email, handle, password} = validation.data

  // 6. Forward only sanitized fields to PDS
  const pdsResponse = await fetch(
    'https://self.surf/xrpc/com.atproto.server.createAccount',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': env.APP_SHARED_SECRET,
      },
      body: JSON.stringify({email, handle, password}),
    },
  )

  // 7. Handle PDS errors with friendly messages
  if (!pdsResponse.ok) {
    const responseContentType =
      pdsResponse.headers.get('Content-Type') || 'application/json'
    const pdsText = await pdsResponse.text()

    try {
      const pdsBody = JSON.parse(pdsText) as Record<string, unknown>
      const errorCode =
        typeof pdsBody.error === 'string' ? pdsBody.error : undefined
      const friendlyMessage =
        errorCode && PDS_ERROR_MESSAGES[errorCode]
          ? PDS_ERROR_MESSAGES[errorCode]
          : pdsBody.message

      return jsonResponse(
        {
          error: pdsBody.error,
          message: friendlyMessage,
        },
        pdsResponse.status,
        origin,
      )
    } catch {
      return new Response(pdsText, {
        status: pdsResponse.status,
        headers: {
          'Content-Type': responseContentType,
          ...corsHeaders(origin),
        },
      })
    }
  }

  // 8. Success — pass through PDS response
  return new Response(pdsResponse.body, {
    status: pdsResponse.status,
    headers: {
      'Content-Type':
        pdsResponse.headers.get('Content-Type') || 'application/json',
      ...corsHeaders(origin),
    },
  })
}
