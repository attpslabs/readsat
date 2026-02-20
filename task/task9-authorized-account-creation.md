# Task 9: Authorized Account Creation

## Context

The PDS at `https://self.surf` requires an `X-App-Secret` header on `com.atproto.server.createAccount` calls. Currently the app calls the PDS directly from the browser via `BskyAgent.createAccount()`, which means the secret would be exposed client-side. Since the app is deployed on Cloudflare Pages, we need a server-side proxy (Pages Function) that injects the secret header before forwarding to the PDS.

**Constraint:** The secret must stay server-side — never exposed to the browser.

---

## Step 1: Create Cloudflare Pages Function

**New file:** `functions/api/create-account.ts`

Cloudflare Pages auto-discovers functions in the `functions/` directory. The path `functions/api/create-account.ts` maps to `https://reads.at/api/create-account`.

**Function responsibilities:**
1. Accept POST request with the same JSON body that `createAccount` sends
2. Read `APP_SECRET` from Cloudflare environment (encrypted env var)
3. Forward request to `https://self.surf/xrpc/com.atproto.server.createAccount` with `X-App-Secret` header added
4. Return the PDS response verbatim (status, body)

```typescript
interface Env {
  APP_SECRET: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!env.APP_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const body = await request.text()

  const pdsResponse = await fetch(
    'https://self.surf/xrpc/com.atproto.server.createAccount',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': env.APP_SECRET,
      },
      body,
    },
  )

  return new Response(pdsResponse.body, {
    status: pdsResponse.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

**Notes:**
- Same-origin request from `reads.at` → no CORS needed
- PDS validates the request body (email, handle, password); proxy just adds the header
- PDS errors (handle taken, invalid email, etc.) pass through verbatim so the existing error handling works

---

## Step 2: Modify BskyAppAgent Fetch Handler

**File to modify:** `src/state/session/agent.ts` (~line 384)

The `BskyAppAgent` class already overrides `fetch` in its constructor. The XRPC client calls this fetch with `(url: URL, init: RequestInit)`. We intercept calls to `createAccount` and rewrite the URL to hit our proxy instead.

**Changes:**
1. Add import: `import {IS_WEB} from '#/env'`
2. Add URL interception at the top of the `fetch` function:

```typescript
async fetch(...args) {
  // On web, route createAccount through our proxy
  // so the server can inject the X-App-Secret header
  if (IS_WEB) {
    const url = args[0]
    if (url instanceof URL && url.pathname === '/xrpc/com.atproto.server.createAccount') {
      args[0] = new URL('/api/create-account', window.location.origin)
    }
  }

  let success = false
  try {
    const result = await realFetch(...args)
    // ... rest unchanged
```

**Why this works:**
- The XRPC client (`@atproto/xrpc`) calls `buildFetchHandler` which resolves the URL as `new URL(path, serviceUrl)` → full URL like `https://self.surf/xrpc/com.atproto.server.createAccount`
- This full `URL` object is passed as `args[0]` to our custom fetch
- We rewrite it to `https://reads.at/api/create-account` (or `http://localhost:*/api/create-account` in dev)
- All other args (method, body, headers) pass through unchanged
- The PDS response flows back through the agent's session hydration (JWT tokens, didDoc, persistSession) unchanged

**`IS_WEB` guard:** Native builds (iOS/Android) are unaffected — they call the PDS directly.

---

## Step 3: Configure Cloudflare Environment Secret

In Cloudflare Pages dashboard → Settings → Environment variables:
- Add `APP_SECRET` (encrypted) with the value expected by `self.surf` in the `X-App-Secret` header
- Set for both Production and Preview environments

---

## Step 4: Profile Creation After Signup

The existing `createAgentAndCreateAccount()` in `agent.ts` already handles profile creation via `agent.upsertProfile()` after account creation (lines 207-219 for non-prod, lines 264-286 for non-prod path). This runs as fire-and-forget via `Promise.allSettled`. No changes needed — the agent's session is properly hydrated by the time this runs because the proxy returns the PDS response verbatim.

---

## Files to Create

| File | Purpose |
|---|---|
| `functions/api/create-account.ts` | Cloudflare Pages Function — proxies createAccount, adds X-App-Secret |

## Files to Modify

| File | Change |
|---|---|
| `src/state/session/agent.ts` | Add `IS_WEB` import; add ~6 lines in `BskyAppAgent` fetch handler to redirect createAccount URL to proxy on web |

---

## Data Flow

```
User fills signup form → useSubmitSignup() → createAccount() → createAgentAndCreateAccount()
  → BskyAppAgent.fetch() intercepts createAccount URL
  → rewrites to /api/create-account (same origin)
  → Cloudflare Pages Function adds X-App-Secret header
  → forwards to https://self.surf/xrpc/com.atproto.server.createAccount
  → PDS creates account, returns {accessJwt, refreshJwt, did, handle, didDoc}
  → response flows back through proxy → agent session hydration → session store
  → profile + feeds created via upsertProfile() (existing code, unchanged)
```

---

## Verification

1. **Build:** `yarn build-web` succeeds (no type errors)
2. **Local test:** `npx wrangler pages dev web-build --binding APP_SECRET=<secret>` — test full signup flow
3. **Deploy:** Push to Cloudflare Pages, set `APP_SECRET` env var, verify signup creates account on `self.surf`
4. **Error handling:** Verify PDS errors (handle taken, invalid email, etc.) still surface correctly in signup form
5. **Profile:** Verify new account has a profile record created (no "Profile not found" errors)
6. **Native unaffected:** Verify native builds still call PDS directly (IS_WEB guard)
