# Task 8: Goodreads RSS Sync

## Context

Users can do a one-time CSV import via bookhive.buzz/import to write books to their PDS, but this is point-in-time. When they update books on Goodreads (e.g., mark "currently reading" as "read"), those changes don't sync. Since users already store their Goodreads profile URL on their PDS (`at.reads.goodreads`), we can use Goodreads' public RSS feeds to pull the latest shelf data and update their `buzz.bookhive.book` records accordingly.

**RSS feed URL format:** `https://www.goodreads.com/review/list_rss/{userId}?shelf={shelfName}`
**Limitation:** 100 items per shelf, no pagination — acceptable for incremental sync.

---

## Step 1: Create Goodreads RSS Proxy Worker

**New directory:** `workers/goodreads-rss-proxy/`

A Cloudflare Worker that fetches a Goodreads RSS feed, parses the XML, and returns clean JSON. This is needed because Goodreads doesn't serve CORS headers.

**Files to create:**
- `workers/goodreads-rss-proxy/wrangler.toml` — modeled on `workers/bookhive-proxy/wrangler.toml`
- `workers/goodreads-rss-proxy/src/index.ts` — main worker logic
- `workers/goodreads-rss-proxy/package.json` — with `fast-xml-parser` dependency
- `workers/goodreads-rss-proxy/tsconfig.json`

**Worker endpoint:** `GET /rss?userId={id}&shelf={shelf}`

**Worker responsibilities:**
1. Validate origin (same allowed origins as bookhive-proxy)
2. Fetch `https://www.goodreads.com/review/list_rss/{userId}?shelf={shelf}`
3. Parse XML to JSON using `fast-xml-parser`
4. Return normalized JSON array of books:
```typescript
interface GoodreadsRssBook {
  goodreadsId: string    // from book_id
  title: string
  author: string
  isbn: string
  rating: number         // user_rating (1-5)
  imageUrl: string       // book_image_url
  shelf: string          // user_shelves
  dateAdded: string      // user_date_added
  dateRead: string       // user_read_at
}
```
5. Add CORS headers to response

**Discord webhook for unmatched books:**
- Worker also has a POST endpoint `POST /report-missing` that forwards unmatched book titles to a Discord webhook (URL stored as worker env secret `DISCORD_WEBHOOK_URL`)

---

## Step 2: Create Goodreads RSS Query Hooks

**New file:** `src/state/queries/goodreads-rss.ts`

Following the pattern in `src/state/queries/goodreads.ts` and `src/state/queries/bookhive.ts`.

**Functions:**
- `fetchGoodreadsRss(userId: string, shelf: string)` — fetch from the proxy worker, return `GoodreadsRssBook[]`
- `extractGoodreadsUserId(url: string): string | null` — parse numeric ID from profile URL (`/user/show/12345` or `/review/list/12345`)
- `useGoodreadsSyncMutation()` — mutation hook that:
  1. Fetches all 3 shelves (currently-reading, read, to-read) from RSS
  2. For each book, looks up in BookHive by goodreadsId via `buzz.bookhive.getBook?goodreadsId=X`
  3. Maps shelf to status: `currently-reading` -> `#reading`, `read` -> `#finished`, `to-read` -> `#wantToRead`
  4. Lists existing `buzz.bookhive.book` records from user's PDS via `listRecords`
  5. Creates or updates `buzz.bookhive.book` records using `putRecord` (using goodreadsId-based rkey for deduplication)
  6. For books not found in BookHive, collects them and reports to Discord webhook via the worker
  7. Returns `{ synced: number, notFound: GoodreadsRssBook[] }`

**Deduplication strategy:** Use a deterministic rkey derived from the goodreadsId (e.g., `gr-{goodreadsId}`) so `putRecord` upserts rather than creating duplicates.

**Shelf-to-status mapping:**
| Goodreads shelf | BookHive status |
|---|---|
| `currently-reading` | `buzz.bookhive.defs#reading` |
| `read` | `buzz.bookhive.defs#finished` |
| `to-read` | `buzz.bookhive.defs#wantToRead` |

---

## Step 3: Create Sidebar Goodreads Sync Widget

**New file:** `src/view/shell/desktop/SidebarGoodreadsSync.tsx`

A sidebar widget that appears below the genres panel in the right nav when on the Books screen. Modeled on the pattern in `src/view/shell/desktop/SidebarGenres.tsx`.

**Behavior:**
- Uses `useGoodreadsQuery(did)` to check if user has a Goodreads URL stored
- If **no URL stored**: show a text field + save button to add their Goodreads profile URL (reusing `useGoodreadsMutation()`)
- If **URL stored**: show a "Sync from Goodreads" button with a refresh icon
- When sync button pressed: call `useGoodreadsSyncMutation()`
- During sync: show a loader/spinner
- After sync: show toast with results ("15 books synced, 3 not found in catalog - we'll import them soon!")
- If `notFound.length > 0`: the mutation also POSTs to Discord webhook via the worker

**Modify:** `src/view/shell/desktop/RightNav.tsx` line 105 — add `<SidebarGoodreadsSync />` alongside `<SidebarGenres />` when `isBooks` is true.

---

## Step 4: i18n

Run `yarn intl:build` after all string changes are complete.

---

## Files to Create
| File | Purpose |
|---|---|
| `workers/goodreads-rss-proxy/wrangler.toml` | Worker config |
| `workers/goodreads-rss-proxy/package.json` | Worker deps (fast-xml-parser) |
| `workers/goodreads-rss-proxy/tsconfig.json` | Worker TS config |
| `workers/goodreads-rss-proxy/src/index.ts` | RSS fetch + XML parse + CORS proxy + Discord webhook relay |
| `src/state/queries/goodreads-rss.ts` | Query hooks for RSS sync |
| `src/view/shell/desktop/SidebarGoodreadsSync.tsx` | Sidebar sync widget UI |

## Files to Modify
| File | Change |
|---|---|
| `src/view/shell/desktop/RightNav.tsx` | Add `SidebarGoodreadsSync` import + render when `isBooks` |

---

## Verification

1. **Worker:** Deploy worker with `cd workers/goodreads-rss-proxy && npx wrangler deploy`, test with curl
2. **UI:** Run `yarn web`, navigate to Books tab, verify sidebar shows Goodreads sync widget
3. **Sync flow (no URL):** Confirm text field + save button appears, enter a Goodreads URL, verify it saves to PDS
4. **Sync flow (with URL):** Click "Sync from Goodreads", verify books are fetched from RSS, matched via BookHive, and written as `buzz.bookhive.book` records to PDS
5. **Unmatched books:** Verify toast shows count of unmatched books and Discord webhook receives the notification
6. **Deduplication:** Run sync twice, verify no duplicate records are created (same rkeys)
7. **Run `yarn typecheck` and `yarn lint`** to verify no type/lint errors
