/**
 * Tests for the hardened create-account Cloudflare Pages Function proxy.
 *
 * We import the handler functions directly by treating the module as a
 * plain TypeScript file. Because the Cloudflare `PagesFunction` type is
 * not available in this test environment, we cast the exported handlers
 * to a minimal compatible shape.
 */

// Minimal type that mirrors what the handlers actually use from the CF context
interface MinimalContext {
  request: Request
  env: {APP_SHARED_SECRET: string}
}

const mod = require('../create-account') as {
  onRequestOptions: (ctx: MinimalContext) => Promise<Response>
  onRequestPost: (ctx: MinimalContext) => Promise<Response>
}

const {onRequestOptions, onRequestPost} = mod

const VALID_ORIGIN = 'https://reads.at'
const LOCALHOST_ORIGIN = 'http://localhost:8080'
const BAD_ORIGIN = 'https://evil.com'
const SECRET = 'test-secret-123'

function makeRequest(
  body: object | string | null,
  overrides: {
    origin?: string | null
    contentType?: string | null
    method?: string
  } = {},
): Request {
  const {
    origin = VALID_ORIGIN,
    contentType = 'application/json',
    method = 'POST',
  } = overrides
  const headers = new Headers()
  if (origin !== null) headers.set('Origin', origin)
  if (contentType !== null) headers.set('Content-Type', contentType)

  return new Request('https://reads.at/api/create-account', {
    method,
    headers,
    body:
      body === null
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
  })
}

function ctx(request: Request, secret: string = SECRET): MinimalContext {
  return {request, env: {APP_SHARED_SECRET: secret}}
}

const validBody = {
  email: 'user@example.com',
  handle: 'testuser.self.surf',
  password: 'securepass123',
}

// ─── CORS Preflight ────────────────────────────────────────────────

describe('onRequestOptions (CORS preflight)', () => {
  it('returns 204 with CORS headers for allowed origin', async () => {
    const req = makeRequest(null, {origin: VALID_ORIGIN, method: 'OPTIONS'})
    const res = await onRequestOptions(ctx(req))
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST')
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })

  it('returns 204 for localhost origin', async () => {
    const req = makeRequest(null, {
      origin: LOCALHOST_ORIGIN,
      method: 'OPTIONS',
    })
    const res = await onRequestOptions(ctx(req))
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      LOCALHOST_ORIGIN,
    )
  })

  it('returns 403 for disallowed origin', async () => {
    const req = makeRequest(null, {origin: BAD_ORIGIN, method: 'OPTIONS'})
    const res = await onRequestOptions(ctx(req))
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('returns 403 when no Origin header', async () => {
    const req = makeRequest(null, {origin: null, method: 'OPTIONS'})
    const res = await onRequestOptions(ctx(req))
    expect(res.status).toBe(403)
  })

  it('falls back to Referer header when Origin is missing', async () => {
    const req = new Request('https://reads.at/api/create-account', {
      method: 'OPTIONS',
      headers: {Referer: 'https://reads.at/signup'},
    })
    const res = await onRequestOptions(ctx(req))
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN)
  })
})

// ─── Origin Validation ─────────────────────────────────────────────

describe('onRequestPost - origin validation', () => {
  it('rejects disallowed origins with 403', async () => {
    const req = makeRequest(validBody, {origin: BAD_ORIGIN})
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('rejects missing origin with 403', async () => {
    const req = makeRequest(validBody, {origin: null})
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(403)
  })
})

// ─── Server Config ─────────────────────────────────────────────────

describe('onRequestPost - server config', () => {
  it('returns 500 when APP_SHARED_SECRET is empty', async () => {
    const req = makeRequest(validBody)
    const res = await onRequestPost(ctx(req, ''))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Server configuration error')
    // Should still have CORS since origin was valid
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN)
  })
})

// ─── Content-Type ──────────────────────────────────────────────────

describe('onRequestPost - Content-Type check', () => {
  it('rejects non-JSON Content-Type with 400', async () => {
    const req = makeRequest(validBody, {contentType: 'text/plain'})
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Content-Type must be application/json')
  })

  it('rejects missing Content-Type with 400', async () => {
    const req = makeRequest(validBody, {contentType: null})
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
  })

  it('accepts application/json; charset=utf-8', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({did: 'did:plc:test'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
    const req = makeRequest(validBody, {
      contentType: 'application/json; charset=utf-8',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(200)
  })
})

// ─── JSON Parsing ──────────────────────────────────────────────────

describe('onRequestPost - JSON parsing', () => {
  it('rejects invalid JSON with 400', async () => {
    const req = makeRequest('not valid json {{{')
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON body')
  })
})

// ─── Input Validation ──────────────────────────────────────────────

describe('onRequestPost - input validation', () => {
  it('rejects missing email', async () => {
    const req = makeRequest({handle: 'test.self.surf', password: '12345678'})
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Missing required field: email')
  })

  it('rejects invalid email format', async () => {
    const req = makeRequest({
      email: 'not-an-email',
      handle: 'test.self.surf',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid email address')
  })

  it('rejects missing handle', async () => {
    const req = makeRequest({email: 'a@b.com', password: '12345678'})
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Missing required field: handle')
  })

  it('rejects handle without .self.surf suffix', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'test.bsky.social',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Handle must end with .self.surf')
  })

  it('rejects handle with username too short (< 3 chars)', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'ab.self.surf',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Handle must be/)
  })

  it('rejects handle with username too long (> 20 chars)', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'abcdefghijklmnopqrstu.self.surf', // 21 chars
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Handle must be/)
  })

  it('rejects handle with leading hyphen', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      handle: '-testuser.self.surf',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Handle must be/)
  })

  it('rejects handle with trailing hyphen', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'testuser-.self.surf',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Handle must be/)
  })

  it('rejects handle with uppercase (after normalization fails regex)', async () => {
    // Uppercase gets lowercased, so "TESTUSER" becomes "testuser" which is valid
    // But "TEST_USER" would become "test_user" which fails the regex
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'test_user.self.surf',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
  })

  it('accepts valid handle with mixed case (normalizes to lowercase)', async () => {
    // This will pass validation but fail at fetch since we aren't mocking it
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({did: 'did:plc:test'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'TestUser.self.surf',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    // Should not be a 400 validation error
    expect(res.status).not.toBe(400)
    // Check that the forwarded handle is lowercased
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const forwardedBody = JSON.parse(fetchCall[1].body)
    expect(forwardedBody.handle).toBe('testuser.self.surf')
  })

  it('rejects missing password', async () => {
    const req = makeRequest({email: 'a@b.com', handle: 'test.self.surf'})
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Missing required field: password')
  })

  it('rejects password shorter than 8 characters', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'test.self.surf',
      password: '1234567',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Password must be at least 8 characters')
  })

  it('accepts 3-char username (minimum)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({did: 'did:plc:test'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'abc.self.surf',
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).not.toBe(400)
  })

  it('accepts 20-char username (maximum)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({did: 'did:plc:test'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
    const req = makeRequest({
      email: 'a@b.com',
      handle: 'abcdefghijklmnopqrst.self.surf', // 20 chars
      password: '12345678',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).not.toBe(400)
  })
})

// ─── Field Stripping ───────────────────────────────────────────────

describe('onRequestPost - field stripping', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('only forwards email, handle, password to PDS', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({did: 'did:plc:test'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
    const req = makeRequest({
      ...validBody,
      inviteCode: 'invite-123',
      verificationPhone: '+1234567890',
      verificationCode: '123456',
      extraField: 'should be stripped',
    })
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(200)

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const forwardedBody = JSON.parse(fetchCall[1].body)
    expect(Object.keys(forwardedBody).sort()).toEqual([
      'email',
      'handle',
      'password',
    ])
    expect(forwardedBody.email).toBe(validBody.email)
    expect(forwardedBody.handle).toBe(validBody.handle)
    expect(forwardedBody.password).toBe(validBody.password)
  })

  it('sends X-App-Secret header to PDS', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({did: 'did:plc:test'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
    const req = makeRequest(validBody)
    await onRequestPost(ctx(req))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].headers['X-App-Secret']).toBe(SECRET)
  })
})

// ─── PDS Error Mapping ─────────────────────────────────────────────

describe('onRequestPost - PDS error mapping', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('maps HandleNotAvailable to friendly message', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'HandleNotAvailable',
          message: 'Handle already taken',
        }),
        {status: 400, headers: {'Content-Type': 'application/json'}},
      ),
    )
    const req = makeRequest(validBody)
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('HandleNotAvailable')
    expect(body.message).toBe(
      'That handle is already taken. Please choose another.',
    )
  })

  it('maps RateLimitExceeded to friendly message', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({error: 'RateLimitExceeded', message: 'slow down'}),
          {status: 429, headers: {'Content-Type': 'application/json'}},
        ),
      )
    const req = makeRequest(validBody)
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('RateLimitExceeded')
    expect(body.message).toBe(
      'Too many attempts. Please wait a moment and try again.',
    )
  })

  it('passes through unmapped PDS errors', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'SomeUnknownError',
          message: 'Something weird happened',
        }),
        {status: 500, headers: {'Content-Type': 'application/json'}},
      ),
    )
    const req = makeRequest(validBody)
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('SomeUnknownError')
    expect(body.message).toBe('Something weird happened')
  })

  it('includes CORS headers on PDS error responses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({error: 'HandleNotAvailable', message: 'taken'}),
          {status: 400, headers: {'Content-Type': 'application/json'}},
        ),
      )
    const req = makeRequest(validBody)
    const res = await onRequestPost(ctx(req))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN)
  })
})

// ─── Success Path ──────────────────────────────────────────────────

describe('onRequestPost - success', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns PDS success response with CORS headers', async () => {
    const pdsResponseBody = {
      did: 'did:plc:testuser123',
      handle: 'testuser.self.surf',
      accessJwt: 'jwt-token',
      refreshJwt: 'refresh-token',
    }
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(pdsResponseBody), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
    const req = makeRequest(validBody)
    const res = await onRequestPost(ctx(req))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.did).toBe('did:plc:testuser123')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN)
  })
})
