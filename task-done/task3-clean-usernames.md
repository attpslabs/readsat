# Task 3: Clean Usernames

## Objective
Instead of `reads.at/profile/alice.self.surf`, links should be `reads.at/alice`.

## Current Behavior

Profile URLs use the format `/profile/:identifier` where identifier is either a full handle (e.g. `alice.self.surf`) or a DID.

### How Routing Works Today

#### Client-Side (React Navigation)
- **Route definitions** — `src/routes.ts` (line 26): `Profile: ['/profile/:name', '/profile/:name/rss']`
- **Navigation params** — `src/lib/routes/types.ts` (line 18): `Profile: {name: string; hideBackButton?: boolean}`
- **Link builder** — `src/lib/routes/links.ts` (lines 5-17): `makeProfileLink()` generates `/profile/{handle}` URLs, preferring handle over DID.
- **Link component** — `src/components/Link.tsx` (lines 83-218): `useLink()` hook parses URLs through the router, matching screen names and dispatching navigation.
- **Router** — `src/lib/routes/router.ts`: Custom regex-based path matcher that extracts named params.

#### Server-Side (bskyweb — Go/Echo)
- **Route registration** — `bskyweb/cmd/bskyweb/server.go` (lines 326-343): `e.GET("/profile/:handleOrDID", server.WebProfile)` plus all sub-routes.
- **Profile handler** — `bskyweb/cmd/bskyweb/server.go` (lines 636-670): `WebProfile()` parses the identifier, calls `ActorGetProfile()`, renders `profile.html`.

#### Handle Resolution
- **`src/state/queries/resolve-uri.ts`** (lines 30-53): `useResolveDidQuery()` — if input starts with `did:`, returns it directly; otherwise calls `agent.resolveHandle()`.
- **`src/state/queries/handle.ts`**: `useFetchDid()` — similar resolution with caching.

#### Sharing / External URLs
- **`src/lib/strings/url-helpers.ts`** (lines 81-88): `toShareUrl()` — prepends `https://bsky.app` to relative paths. This must change to `https://reads.at`.
- **`src/lib/strings/url-helpers.ts`** (lines 10-27): `BSKY_TRUSTED_HOSTS` — list of trusted domains for internal link detection. Must add `reads.at`.

#### Deep Linking
- **`app.config.js`** (lines 25-32): `ASSOCIATED_DOMAINS` — currently `applinks:bsky.app`. Must add `reads.at`.
- **`app.config.js`** (lines 192-211): Android intent filters — `host: 'bsky.app'`. Must add `reads.at`.
- **`bskyweb/static/.well-known/assetlinks.json`**: Android app links verification.

#### Handle Utilities
- **`src/lib/strings/handles.ts`**: `createFullHandle()`, `sanitizeHandle()`, `validateServiceHandle()`, `isInvalidHandle()`.

## Changes Required

### 1. Add Root-Level Username Route
**Files**: `src/routes.ts`, `bskyweb/cmd/bskyweb/server.go`
- Add a new route pattern `/:name` that resolves to the Profile screen.
- On the server side, add `e.GET("/:handleOrDID", server.WebProfile)` — but must be careful to not conflict with other top-level routes (e.g. `/search`, `/settings`, `/notifications`).
- Strategy: register all known top-level routes first, then add a catch-all `/:handleOrDID` route last. The server should attempt handle resolution and 404 if invalid.

### 2. Update `makeProfileLink()` to Omit `/profile/` Prefix
**File**: `src/lib/routes/links.ts`
- Change `makeProfileLink()` to return `/{handle}` instead of `/profile/{handle}`.
- For `self.surf` handles, strip the `.self.surf` suffix so `alice.self.surf` becomes just `/alice`.
- For non-self.surf handles, keep the full handle: `/alice.otherpds.com`.

### 3. Update Client-Side Router
**File**: `src/lib/routes/router.ts`, `src/routes.ts`
- Add `/:name` as a valid route pattern for Profile.
- Keep `/profile/:name` as a fallback/redirect for backwards compatibility.

### 4. Update `toShareUrl()` Domain
**File**: `src/lib/strings/url-helpers.ts`
- Change `https://bsky.app` to `https://reads.at`.
- Update `BSKY_TRUSTED_HOSTS` to include `reads.at`.

### 5. Handle Suffix Stripping
**File**: `src/lib/strings/handles.ts` (or new utility)
- Add `DEFAULT_PDS_SUFFIX = '.self.surf'` constant.
- Add `displayHandle(handle)` — strips `.self.surf` for display.
- Add `expandHandle(shortHandle)` — appends `.self.surf` if no dots present.
- Update `makeProfileLink()` and display components to use `displayHandle()`.

### 6. Server-Side Routing (bskyweb)
**File**: `bskyweb/cmd/bskyweb/server.go`
- Add catch-all route for `/:handleOrDID` after all other top-level routes.
- Add redirect from `/profile/:handleOrDID` → `/:handleOrDID` (301) for SEO.
- Handle resolution: attempt to resolve the identifier; if it fails, serve 404.

### 7. Deep Link / Universal Link Config
**File**: `app.config.js`
- Add `reads.at` to `ASSOCIATED_DOMAINS` and Android intent filters.

### 8. Sub-Routes
Profile sub-routes also need clean versions:
- `reads.at/alice/post/xyz` instead of `reads.at/profile/alice.self.surf/post/xyz`
- `reads.at/alice/followers` instead of `reads.at/profile/alice.self.surf/followers`
- Update all route patterns in `src/routes.ts` and `bskyweb/cmd/bskyweb/server.go`.

## Edge Cases
- **Collision with app routes**: Usernames like `search`, `settings`, `notifications` must be reserved. Maintain a blocklist.
- **Non-self.surf handles**: Users on other PDSes keep their full domain handle in the URL.
- **Backwards compatibility**: `/profile/:handle` should still work (redirect to clean URL).
- **DID URLs**: `/profile/did:plc:xyz` should still work as a fallback.

## Notes
- This is similar to how Twitter uses `twitter.com/username` — the catch-all route pattern with reserved word blocklist.
- The handle suffix stripping mirrors what Linkname does with `displayHandle()` / `expandHandle()` in `src/lib/utils.ts`.
