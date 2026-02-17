/**
 * Cloudflare Worker: Bookclub API
 *
 * Proxies bookclub create/update/delete requests to the reads.at
 * service account's PDS. All bookclub and book records live on
 * the reads.at repo so they're discoverable by all users.
 *
 * Routes:
 *   POST /club             — create a bookclub
 *   POST /club/update      — update a bookclub name
 *   POST /club/delete      — delete a bookclub
 *   POST /book             — add a book to a club
 *   POST /member/request   — mirror a join request to reads.at repo
 *   POST /member/cancel    — cancel/delete a mirrored join request
 *   POST /member/approve   — admin approves a join request
 *   POST /member/deny      — admin denies a join request
 *
 * The reads.at app password must be set as a Wrangler secret:
 *   wrangler secret put READSAT_APP_PASSWORD
 */

interface Env {
  READSAT_PDS_URL: string
  READSAT_HANDLE: string
  READSAT_APP_PASSWORD: string
}

interface Session {
  did: string
  accessJwt: string
}

const BOOKCLUB_COLLECTION = 'at.reads.bookclub'
const BOOKCLUB_BOOK_COLLECTION = 'at.reads.bookclub.book'
const BOOKCLUB_MEMBER_COLLECTION = 'at.reads.bookclub.member'

const ALLOWED_ORIGINS = [
  'https://reads.at',
  'http://localhost:19006',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
]

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

async function createSession(env: Env): Promise<Session> {
  const res = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.server.createSession`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        identifier: env.READSAT_HANDLE,
        password: env.READSAT_APP_PASSWORD,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Session failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  return {did: data.did, accessJwt: data.accessJwt}
}

async function createRecord(
  env: Env,
  session: Session,
  collection: string,
  record: unknown,
): Promise<{uri: string; cid: string}> {
  const res = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.repo.createRecord`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection,
        record,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createRecord failed: ${res.status} ${text}`)
  }
  return await res.json()
}

async function putRecord(
  env: Env,
  session: Session,
  collection: string,
  rkey: string,
  record: unknown,
): Promise<{uri: string; cid: string}> {
  const res = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.repo.putRecord`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection,
        rkey,
        record,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`putRecord failed: ${res.status} ${text}`)
  }
  return await res.json()
}

async function deleteRecord(
  env: Env,
  session: Session,
  collection: string,
  rkey: string,
): Promise<void> {
  const res = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.repo.deleteRecord`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection,
        rkey,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`deleteRecord failed: ${res.status} ${text}`)
  }
}

async function getRecord(
  env: Env,
  session: Session,
  collection: string,
  rkey: string,
): Promise<{uri: string; value: Record<string, unknown>} | null> {
  const res = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.repo.getRecord?` +
      `repo=${session.did}&collection=${collection}&rkey=${rkey}`,
    {
      headers: {Authorization: `Bearer ${session.accessJwt}`},
    },
  )
  if (!res.ok) return null
  return await res.json()
}

/**
 * Verify caller's identity by validating their access token against the PDS.
 * Returns the caller's DID if valid.
 */
async function verifyCallerDid(
  authHeader: string | null,
  pdsUrl: string,
): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = authHeader.slice(7)
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.getSession`, {
    headers: {Authorization: `Bearer ${token}`},
  })
  if (!res.ok) {
    throw new Error('Invalid session token')
  }
  const data = await res.json()
  return data.did
}

// --- Route handlers ---

async function handleCreateClub(
  body: {name: string; adminDid: string},
  env: Env,
  session: Session,
): Promise<Response> {
  const {name, adminDid} = body
  if (!name || !adminDid) {
    return jsonResponse({error: 'name and adminDid required'}, 400, null)
  }

  const record = {
    $type: BOOKCLUB_COLLECTION,
    name,
    admin: adminDid,
    createdBy: adminDid,
    createdAt: new Date().toISOString(),
  }

  const res = await createRecord(env, session, BOOKCLUB_COLLECTION, record)
  const rkey = res.uri.split('/').pop()!
  return jsonResponse({uri: res.uri, rkey, record}, 200, null)
}

async function handleUpdateClub(
  body: {rkey: string; name: string; adminDid: string},
  env: Env,
  session: Session,
): Promise<Response> {
  const {rkey, name, adminDid} = body
  if (!rkey || !name || !adminDid) {
    return jsonResponse({error: 'rkey, name, and adminDid required'}, 400, null)
  }

  // Fetch the existing record to verify admin ownership
  const getRes = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.repo.getRecord?` +
      `repo=${session.did}&collection=${BOOKCLUB_COLLECTION}&rkey=${rkey}`,
    {
      headers: {Authorization: `Bearer ${session.accessJwt}`},
    },
  )
  if (!getRes.ok) {
    return jsonResponse({error: 'Club not found'}, 404, null)
  }
  const existing = await getRes.json()

  if (existing.value.admin !== adminDid) {
    return jsonResponse({error: 'Not authorized'}, 403, null)
  }

  const record = {
    ...existing.value,
    name,
  }

  await putRecord(env, session, BOOKCLUB_COLLECTION, rkey, record)
  return jsonResponse({ok: true}, 200, null)
}

async function handleDeleteClub(
  body: {rkey: string; adminDid: string},
  env: Env,
  session: Session,
): Promise<Response> {
  const {rkey, adminDid} = body
  if (!rkey || !adminDid) {
    return jsonResponse({error: 'rkey and adminDid required'}, 400, null)
  }

  // Verify admin ownership
  const getRes = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.repo.getRecord?` +
      `repo=${session.did}&collection=${BOOKCLUB_COLLECTION}&rkey=${rkey}`,
    {
      headers: {Authorization: `Bearer ${session.accessJwt}`},
    },
  )
  if (!getRes.ok) {
    return jsonResponse({error: 'Club not found'}, 404, null)
  }
  const existing = await getRes.json()

  if (existing.value.admin !== adminDid) {
    return jsonResponse({error: 'Not authorized'}, 403, null)
  }

  await deleteRecord(env, session, BOOKCLUB_COLLECTION, rkey)
  return jsonResponse({ok: true}, 200, null)
}

async function handleAddBook(
  body: {
    clubUri: string
    bookTitle: string
    bookAuthors?: string
    bookCover?: string
    bookHiveId?: string
    adminDid: string
  },
  env: Env,
  session: Session,
): Promise<Response> {
  const {clubUri, bookTitle, adminDid} = body
  if (!clubUri || !bookTitle || !adminDid) {
    return jsonResponse(
      {error: 'clubUri, bookTitle, and adminDid required'},
      400,
      null,
    )
  }

  // Verify admin ownership of the club
  const clubRkey = clubUri.split('/').pop()!
  const getRes = await fetch(
    `${env.READSAT_PDS_URL}/xrpc/com.atproto.repo.getRecord?` +
      `repo=${session.did}&collection=${BOOKCLUB_COLLECTION}&rkey=${clubRkey}`,
    {
      headers: {Authorization: `Bearer ${session.accessJwt}`},
    },
  )
  if (!getRes.ok) {
    return jsonResponse({error: 'Club not found'}, 404, null)
  }
  const club = await getRes.json()

  if (club.value.admin !== adminDid) {
    return jsonResponse({error: 'Not authorized'}, 403, null)
  }

  const record = {
    $type: BOOKCLUB_BOOK_COLLECTION,
    club: clubUri,
    bookTitle: body.bookTitle,
    bookAuthors: body.bookAuthors,
    bookCover: body.bookCover,
    bookHiveId: body.bookHiveId,
    startedAt: new Date().toISOString(),
  }

  const res = await createRecord(env, session, BOOKCLUB_BOOK_COLLECTION, record)
  const rkey = res.uri.split('/').pop()!
  return jsonResponse({uri: res.uri, rkey, record}, 200, null)
}

async function handleMemberRequest(
  body: {clubUri: string; handle: string; adminDid: string},
  env: Env,
  session: Session,
): Promise<Response> {
  const {clubUri, handle, adminDid: callerDid} = body
  if (!clubUri || !handle || !callerDid) {
    return jsonResponse({error: 'clubUri and handle required'}, 400, null)
  }

  const record = {
    $type: BOOKCLUB_MEMBER_COLLECTION,
    club: clubUri,
    did: callerDid,
    handle,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  const res = await createRecord(
    env,
    session,
    BOOKCLUB_MEMBER_COLLECTION,
    record,
  )
  const rkey = res.uri.split('/').pop()!
  return jsonResponse({uri: res.uri, rkey, record}, 200, null)
}

async function handleMemberCancel(
  body: {clubUri: string; rkey: string; adminDid: string},
  env: Env,
  session: Session,
): Promise<Response> {
  const {rkey, adminDid: callerDid} = body
  if (!rkey || !callerDid) {
    return jsonResponse({error: 'rkey required'}, 400, null)
  }

  // Verify the caller owns this request
  const existing = await getRecord(
    env,
    session,
    BOOKCLUB_MEMBER_COLLECTION,
    rkey,
  )
  if (!existing) {
    return jsonResponse({error: 'Request not found'}, 404, null)
  }
  if (existing.value.did !== callerDid) {
    return jsonResponse({error: 'Not authorized'}, 403, null)
  }

  await deleteRecord(env, session, BOOKCLUB_MEMBER_COLLECTION, rkey)
  return jsonResponse({ok: true}, 200, null)
}

async function handleMemberApprove(
  body: {rkey: string; adminDid: string},
  env: Env,
  session: Session,
): Promise<Response> {
  const {rkey, adminDid: callerDid} = body
  if (!rkey || !callerDid) {
    return jsonResponse({error: 'rkey required'}, 400, null)
  }

  // Get the member request
  const existing = await getRecord(
    env,
    session,
    BOOKCLUB_MEMBER_COLLECTION,
    rkey,
  )
  if (!existing) {
    return jsonResponse({error: 'Request not found'}, 404, null)
  }

  // Get the club to verify admin
  const clubUri = existing.value.club as string
  const clubRkey = clubUri.split('/').pop()!
  const club = await getRecord(env, session, BOOKCLUB_COLLECTION, clubRkey)
  if (!club) {
    return jsonResponse({error: 'Club not found'}, 404, null)
  }
  if (club.value.admin !== callerDid) {
    return jsonResponse({error: 'Not authorized'}, 403, null)
  }

  // Update the record status to approved
  const updated = {
    ...existing.value,
    status: 'approved',
  }
  await putRecord(env, session, BOOKCLUB_MEMBER_COLLECTION, rkey, updated)
  return jsonResponse({ok: true}, 200, null)
}

async function handleMemberDeny(
  body: {rkey: string; adminDid: string},
  env: Env,
  session: Session,
): Promise<Response> {
  const {rkey, adminDid: callerDid} = body
  if (!rkey || !callerDid) {
    return jsonResponse({error: 'rkey required'}, 400, null)
  }

  // Get the member request
  const existing = await getRecord(
    env,
    session,
    BOOKCLUB_MEMBER_COLLECTION,
    rkey,
  )
  if (!existing) {
    return jsonResponse({error: 'Request not found'}, 404, null)
  }

  // Get the club to verify admin
  const clubUri = existing.value.club as string
  const clubRkey = clubUri.split('/').pop()!
  const club = await getRecord(env, session, BOOKCLUB_COLLECTION, clubRkey)
  if (!club) {
    return jsonResponse({error: 'Club not found'}, 404, null)
  }
  if (club.value.admin !== callerDid) {
    return jsonResponse({error: 'Not authorized'}, 403, null)
  }

  await deleteRecord(env, session, BOOKCLUB_MEMBER_COLLECTION, rkey)
  return jsonResponse({ok: true}, 200, null)
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

    if (request.method !== 'POST') {
      return jsonResponse({error: 'Method not allowed'}, 405, allowedOrigin)
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      const body = await request.json()

      // The client sends its PDS URL so we verify the token against the right server
      const pdsUrl =
        typeof body.pdsUrl === 'string' && body.pdsUrl
          ? body.pdsUrl
          : env.READSAT_PDS_URL

      // Verify the caller's identity
      const callerDid = await verifyCallerDid(
        request.headers.get('Authorization'),
        pdsUrl,
      )

      // Authenticate as the reads.at service account
      const session = await createSession(env)

      // Inject the verified caller DID (ignore any client-provided adminDid)
      body.adminDid = callerDid

      let response: Response
      switch (path) {
        case '/club':
          response = await handleCreateClub(
            body as {name: string; adminDid: string},
            env,
            session,
          )
          break
        case '/club/update':
          response = await handleUpdateClub(
            body as {rkey: string; name: string; adminDid: string},
            env,
            session,
          )
          break
        case '/club/delete':
          response = await handleDeleteClub(
            body as {rkey: string; adminDid: string},
            env,
            session,
          )
          break
        case '/book':
          response = await handleAddBook(
            body as {
              clubUri: string
              bookTitle: string
              bookAuthors?: string
              bookCover?: string
              bookHiveId?: string
              adminDid: string
            },
            env,
            session,
          )
          break
        case '/member/request':
          response = await handleMemberRequest(
            body as {clubUri: string; handle: string; adminDid: string},
            env,
            session,
          )
          break
        case '/member/cancel':
          response = await handleMemberCancel(
            body as {clubUri: string; rkey: string; adminDid: string},
            env,
            session,
          )
          break
        case '/member/approve':
          response = await handleMemberApprove(
            body as {rkey: string; adminDid: string},
            env,
            session,
          )
          break
        case '/member/deny':
          response = await handleMemberDeny(
            body as {rkey: string; adminDid: string},
            env,
            session,
          )
          break
        default:
          response = jsonResponse({error: 'Not found'}, 404, allowedOrigin)
      }

      // Add CORS headers to the response
      if (allowedOrigin) {
        const headers = new Headers(response.headers)
        for (const [key, value] of Object.entries(corsHeaders(allowedOrigin))) {
          headers.set(key, value)
        }
        return new Response(response.body, {
          status: response.status,
          headers,
        })
      }

      return response
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return jsonResponse({error: message}, 500, allowedOrigin)
    }
  },
}
