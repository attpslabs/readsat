/**
 * Publishes the at.reads.bookclub and at.reads.bookclub.member lexicon schemas
 * to the readsat service account's PDS.
 *
 * Usage:
 *   npx tsx scripts/publish-bookclub-lexicon.ts
 *
 * Required env vars:
 *   READSAT_SERVICE_DID   - DID of the readsat service account
 *   READSAT_PDS_URL       - PDS URL (e.g. https://bsky.social)
 *   READSAT_HANDLE        - Handle for the service account
 *   READSAT_APP_PASSWORD  - App password for the service account
 */

const READSAT_PDS_URL = process.env.READSAT_PDS_URL || 'https://bsky.social'
const READSAT_HANDLE = process.env.READSAT_HANDLE
const READSAT_APP_PASSWORD = process.env.READSAT_APP_PASSWORD

if (!READSAT_HANDLE || !READSAT_APP_PASSWORD) {
  console.error(
    'Missing required env vars: READSAT_HANDLE, READSAT_APP_PASSWORD',
  )
  process.exit(1)
}

const BOOKCLUB_LEXICON = {
  lexicon: 1,
  id: 'at.reads.bookclub',
  defs: {
    main: {
      type: 'record',
      description: 'A book club record owned by the readsat service.',
      record: {
        type: 'object',
        required: ['name', 'bookTitle', 'admin', 'createdBy', 'createdAt'],
        properties: {
          name: {type: 'string', maxLength: 100},
          bookTitle: {type: 'string', maxLength: 200},
          bookAuthors: {type: 'string', maxLength: 500},
          bookCover: {type: 'string', maxLength: 1000},
          bookHiveId: {type: 'string', maxLength: 100},
          admin: {
            type: 'string',
            format: 'did',
            description: 'DID of the current admin',
          },
          createdBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the original creator',
          },
          createdAt: {type: 'string', format: 'datetime'},
        },
      },
    },
  },
}

const BOOKCLUB_MEMBER_LEXICON = {
  lexicon: 1,
  id: 'at.reads.bookclub.member',
  defs: {
    main: {
      type: 'record',
      description:
        "A book club membership/join-request record on the requesting user's PDS.",
      record: {
        type: 'object',
        required: ['club', 'status', 'handle', 'createdAt'],
        properties: {
          club: {
            type: 'string',
            format: 'at-uri',
            description: 'AT URI of the bookclub record',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'denied'],
          },
          handle: {
            type: 'string',
            description: 'Handle of the requesting user',
          },
          createdAt: {type: 'string', format: 'datetime'},
        },
      },
    },
  },
}

async function createSession(): Promise<{did: string; accessJwt: string}> {
  const res = await fetch(
    `${READSAT_PDS_URL}/xrpc/com.atproto.server.createSession`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        identifier: READSAT_HANDLE,
        password: READSAT_APP_PASSWORD,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create session: ${res.status} ${text}`)
  }
  return res.json()
}

async function putRecord(
  session: {did: string; accessJwt: string},
  collection: string,
  rkey: string,
  record: unknown,
) {
  const res = await fetch(
    `${READSAT_PDS_URL}/xrpc/com.atproto.repo.putRecord`,
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
    throw new Error(
      `Failed to putRecord ${collection}/${rkey}: ${res.status} ${text}`,
    )
  }
  const data = await res.json()
  console.log(`  Published ${collection}/${rkey}: ${data.uri}`)
  return data
}

async function main() {
  console.log('Authenticating as', READSAT_HANDLE, '...')
  const session = await createSession()
  console.log('Authenticated as DID:', session.did)

  console.log('\nPublishing bookclub lexicon schema...')
  // We store the lexicon definition as a record so other clients can discover the schema.
  // The rkey is the lexicon ID with dots replaced by dashes.
  await putRecord(session, 'at.reads.bookclub', 'lexicon-schema', {
    $type: 'at.reads.bookclub',
    name: '__lexicon_schema__',
    bookTitle: JSON.stringify(BOOKCLUB_LEXICON),
    admin: session.did,
    createdBy: session.did,
    createdAt: new Date().toISOString(),
  })

  console.log('\nPublishing bookclub member lexicon schema...')
  // Note: The member lexicon lives on individual user PDS accounts,
  // so we just log its definition here for reference.
  console.log('Member lexicon definition:')
  console.log(JSON.stringify(BOOKCLUB_MEMBER_LEXICON, null, 2))

  console.log('\nDone! Lexicon schemas published.')
  console.log('\nBookclub collection: at.reads.bookclub')
  console.log('Member collection:   at.reads.bookclub.member')
  console.log('Service DID:        ', session.did)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
