# Bookclubs

Bookclubs let users create reading groups, select books to discuss, and invite others to join. All bookclub data is stored on the AT Protocol, making it decentralized and portable.

## User-Facing Features

### Browsing Bookclubs

The Bookclubs tab appears in the left sidebar (desktop) and navigation drawer (mobile). It lists every bookclub on the platform. Each club card displays:

- The current book's cover image (or a placeholder)
- The club name
- A "Currently reading" label with the book title and authors
- A member avatar badge

No login is required to browse the list.

### Creating a Bookclub

Logged-in users can tap the **+** button in the header to start a new bookclub. The creation flow has two steps:

1. **Name the club** -- a text field for the club name.
2. **Select the first book** -- a search bar powered by the BookHive API. If the book isn't found, users are linked to [bookhive.buzz/import](https://bookhive.buzz/import) to import their Goodreads or StoryGraph library.

After selecting a book and tapping "Create Bookclub", two records are written: the club itself and its first book entry.

### Requesting to Join

Non-admin users see a **Request to join** button on each club card. Tapping it creates a pending join request. The button then switches to **Remove request** (secondary style), allowing the user to cancel. The club creator sees "You created this club" instead of a join button.

### Changing the Current Book (Admin)

The club admin (the user who created it) can update the club name and add new books to the discussion log. Each book change is an append-only operation -- the full history of discussed books is preserved with timestamps.

---

## Architecture

### AT Protocol Collections

Three custom AT Protocol record collections power the feature:

| Collection | Stored On | Purpose |
|---|---|---|
| `at.reads.bookclub` | `reads.at` service repo | The club itself (name, admin DID, timestamps) |
| `at.reads.bookclub.book` | `reads.at` service repo | Append-only log of books discussed per club |
| `at.reads.bookclub.member` | Individual user's PDS | Join requests (pending/approved/denied) |

Club and book records live on the `reads.at` service account (`did:plc:j62tft4dizsntyugubmw43t4`) so they are centrally discoverable. Member records live on each user's own PDS, keeping join requests under the user's control.

### Record Schemas

**BookClubRecord** (`at.reads.bookclub`)

```
name        string    Club display name
admin       DID       DID of the current admin
createdBy   DID       DID of the original creator
createdAt   datetime  When the club was created
```

**BookClubBookRecord** (`at.reads.bookclub.book`)

```
club          AT URI    Reference to the parent bookclub record
bookTitle     string    Title of the book
bookAuthors   string    Tab-separated list of authors (optional)
bookCover     string    URL of the cover image (optional)
bookHiveId    string    BookHive catalog ID (optional)
startedAt     datetime  When this book discussion period began
```

Each new book discussion creates a new record. Previous records are never overwritten, forming a timestamped history.

**BookClubMemberRecord** (`at.reads.bookclub.member`)

```
club        AT URI                         Reference to the bookclub
status      'pending' | 'approved' | 'denied'
handle      string                         Handle of the requesting user
createdAt   datetime
```

### Data Flow

```
                    reads.at PDS
                   (service repo)
                  ┌──────────────┐
       list ───> │  bookclub     │ <─── create/update/delete
                 │  bookclub.book│ <─── add book
                 └──────────────┘
                        ^
                        | writes via
                 ┌──────────────┐
                 │ bookclub-api  │  Cloudflare Worker
                 │   Worker      │  (authenticates as reads.at)
                 └──────────────┘
                        ^
                        | POST with user's JWT
                 ┌──────────────┐
                 │  Client App   │
                 └──────────────┘
                        |
                        | direct write
                        v
                 ┌──────────────┐
                 │  User's PDS   │  bookclub.member records
                 └──────────────┘
```

**Reads**: The client queries the `reads.at` service repo directly via `com.atproto.repo.listRecords`. This is a public read -- no authentication needed. All clubs and their books are fetched from one repo.

**Writes (clubs & books)**: The client sends POST requests to the bookclub-api Cloudflare Worker at `https://bookclub-api.attps.workers.dev`. The worker:

1. Verifies the caller's identity by validating their AT Proto session JWT against the PDS
2. Authenticates as the `reads.at` service account using an app password
3. Writes the record to the `reads.at` repo
4. Returns the created record URI and rkey

The caller's DID is always extracted from their verified session -- it cannot be spoofed.

**Writes (join requests)**: These go directly to the user's own PDS via the standard agent. No worker involvement.

### Bookclub API Worker

The worker lives at `workers/bookclub-api/` and exposes four endpoints:

| Endpoint | Purpose | Auth Check |
|---|---|---|
| `POST /club` | Create a bookclub | Verified caller becomes admin |
| `POST /club/update` | Update club name | Must be admin of the club |
| `POST /club/delete` | Delete a bookclub | Must be admin of the club |
| `POST /book` | Add a book to a club | Must be admin of the club |

All endpoints require an `Authorization: Bearer <accessJwt>` header. The worker verifies this token, then performs the write using the `reads.at` service account credentials.

CORS is configured for `reads.at`, `localhost:19006` (Expo web dev), and `localhost:8080`.

**Deployment:**

```bash
cd workers/bookclub-api
npm install
wrangler secret put READSAT_APP_PASSWORD   # set the reads.at app password
wrangler deploy
```

### Book Search

Book search is powered by the BookHive API (`bookhive.buzz`), proxied through the existing `bookhive-proxy` Cloudflare Worker at `https://bookhive-proxy.attps.workers.dev/xrpc`. The search is debounced at 500ms. Results include title, authors, cover image URL, and a BookHive catalog ID.

---

## File Map

```
src/
  screens/BookClubs/
    BookClubsScreen.tsx        Main listing screen (browse all clubs)
    CreateBookClubScreen.tsx   Club creation flow (name + book search)
    BookClubCard.tsx            Individual club card (cover, name, join button)
  state/queries/
    bookclubs.ts               Query hooks, mutations, interfaces, API client
  components/icons/
    BookClub.tsx                Open book icon (outline + filled variants)
  view/shell/
    desktop/LeftNav.tsx         Desktop sidebar nav item
    Drawer.tsx                  Mobile drawer menu item
  lib/
    routes/types.ts             Route type definitions (BookClubs, CreateBookClub)
    hooks/useNavigationTabState.ts   Tab state detection (isAtBookClubs)
    constants.ts                READS_AT_ACCOUNT_DID
  routes.ts                    URL path mappings (/bookclubs, /bookclubs/create)
  Navigation.tsx               Screen registration

workers/
  bookclub-api/
    src/index.ts               Cloudflare Worker (writes to reads.at repo)
    wrangler.toml              Worker config (PDS URL, handle)

scripts/
  publish-bookclub-lexicon.ts  Publishes lexicon schema definitions

bskyweb/cmd/bskyweb/
  server.go                    Web server routes (/bookclubs, /bookclubs/create)
```

---

## Design Decisions

**Why store clubs on a service repo instead of user repos?**
Records on individual user PDSs are only queryable per-user. Storing all clubs on `reads.at` makes them listable in a single query, enabling the global Bookclubs tab.

**Why are join requests on user repos?**
Join requests are user-initiated actions that users should own. Storing them on the user's PDS means users can revoke requests without depending on the service, and the data stays portable if the user moves PDS.

**Why an append-only book log instead of updating a single record?**
Preserving history lets us show what a club has read over time. Each `at.reads.bookclub.book` record captures the book title, cover, and the timestamp when the club started discussing it. Switching books never deletes previous entries.

**Why a Cloudflare Worker instead of writing directly?**
Users can't write to another account's PDS directly. The worker acts as a trusted intermediary: it verifies the caller's identity, then writes to the `reads.at` repo using the service account's credentials. This keeps the app password out of client code.
