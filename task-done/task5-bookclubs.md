# Task 5: Book Clubs

## Objective
Add a dedicated **Book Clubs** tab to the bottom navigation. Users can create a book club for a specific book/series, and other users can request to join if they're reading the same book. Members indicate which book in the series and which chapter they're currently on.

## Ownership Model

### Key Principles
- **Book club records are owned by the readsat social webapp**, not by individual users. All `at.reads.bookclub` records live on the readsat service account's PDS.
- **Only readsat has the right to delete a book club.** Individual users cannot delete clubs.
- The **creator** is the initial admin but can leave. They do not "own" the record on their PDS.

### Admin Succession
1. Creator starts as **admin**
2. Admin can invite **moderators**
3. If the admin leaves:
   - The **first invited moderator** (by timestamp) is promoted to admin
   - If there are no moderators, the club becomes **claimable** — any current member (or anyone) can claim admin
4. Admin role is tracked in the club record, not derived from record ownership

### Moderation
- **Admin** can: invite moderators, approve/deny join requests, remove members, remove moderators, update club details
- **Moderators** can: approve/deny join requests, remove members
- **Neither admin nor moderators can delete the club** — only the readsat service account can
- Removal reasons should be logged for transparency

---

## Feature Requirements

### Creating a Book Club
- A user creates a club tied to a specific book or book series (e.g. "Heated Rivalry")
- Club has: name, description, book title/series
- The client sends a request to the readsat service, which creates the `at.reads.bookclub` record on the **readsat service account's PDS**
- The creator's DID is recorded as the initial admin

### Joining a Book Club
- Users can browse/search for clubs
- To join, the user must confirm they're reading the book/series
- Join is a **request** — admin or moderators approve or deny
- On request, the user specifies:
  - Which book in the series they're currently reading
  - Which chapter they're on

### Leaving a Book Club
- Any member can leave at any time by deleting their membership record
- If the **admin** leaves:
  - First moderator (by invite date) becomes admin
  - If no moderators exist, club enters "claimable" state
- If a **moderator** leaves, they simply lose their moderator role

### Claiming an Adminless Club
- When a club has no admin and no moderators, any user can claim admin
- The client sends a claim request to the readsat service, which updates the club record

---

## Lexicon Records

### `at.reads.bookclub` — Club definition (on readsat service PDS)
```json
{
  "lexicon": 1,
  "id": "at.reads.bookclub",
  "defs": {
    "main": {
      "type": "record",
      "description": "A book club record owned by the readsat service.",
      "record": {
        "type": "object",
        "required": ["name", "bookTitle", "admin", "createdAt"],
        "properties": {
          "name": { "type": "string", "maxLength": 100 },
          "description": { "type": "string", "maxLength": 500 },
          "bookTitle": { "type": "string", "maxLength": 200 },
          "bookSeries": { "type": "string", "maxLength": 200 },
          "admin": { "type": "string", "format": "did", "description": "DID of the current admin" },
          "moderators": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["did", "invitedAt"],
              "properties": {
                "did": { "type": "string", "format": "did" },
                "invitedAt": { "type": "string", "format": "datetime" }
              }
            },
            "description": "Ordered list of moderators. First by invitedAt becomes admin on admin departure."
          },
          "createdBy": { "type": "string", "format": "did", "description": "DID of the original creator" },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `at.reads.bookclub.member` — Membership record (on member's PDS)
```json
{
  "lexicon": 1,
  "id": "at.reads.bookclub.member",
  "defs": {
    "main": {
      "type": "record",
      "description": "A book club membership record tracking reading progress.",
      "record": {
        "type": "object",
        "required": ["club", "status", "createdAt"],
        "properties": {
          "club": { "type": "string", "format": "at-uri", "description": "AT URI of the bookclub record on the readsat service PDS" },
          "status": { "type": "string", "enum": ["pending", "approved", "denied"] },
          "currentBook": { "type": "string", "maxLength": 200 },
          "currentChapter": { "type": "string", "maxLength": 100 },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `at.reads.bookclub.action` — Moderation actions (on readsat service PDS)
```json
{
  "lexicon": 1,
  "id": "at.reads.bookclub.action",
  "defs": {
    "main": {
      "type": "record",
      "description": "A moderation action on a book club (approve, deny, remove, promote, demote).",
      "record": {
        "type": "object",
        "required": ["subject", "club", "action", "actorDid", "createdAt"],
        "properties": {
          "subject": { "type": "string", "format": "did", "description": "DID of the user being acted upon" },
          "club": { "type": "string", "format": "at-uri" },
          "action": { "type": "string", "enum": ["approve", "deny", "remove", "promote_mod", "demote_mod"] },
          "actorDid": { "type": "string", "format": "did", "description": "DID of the admin/mod who performed the action" },
          "reason": { "type": "string", "maxLength": 500, "description": "Optional reason for the action" },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

---

## Readsat Service API

Since club records live on the readsat service's PDS, the client cannot directly `putRecord` on them. Instead, the readsat webapp exposes API routes that the client calls. The service authenticates the caller and writes records on its own PDS.

### API Routes (on readsat webapp)
| Route | Auth | Purpose |
|---|---|---|
| `POST /api/bookclubs/create` | User JWT | Creates a new club record on the service PDS. Sets caller as admin. |
| `PUT /api/bookclubs/:rkey` | Admin JWT | Updates club details (name, description, book info). |
| `DELETE /api/bookclubs/:rkey` | **Service-only** | Deletes a club. Not exposed to users. |
| `POST /api/bookclubs/:rkey/approve` | Admin/Mod JWT | Approves a pending member. Writes `at.reads.bookclub.action`. |
| `POST /api/bookclubs/:rkey/deny` | Admin/Mod JWT | Denies a pending member. |
| `POST /api/bookclubs/:rkey/remove` | Admin/Mod JWT | Removes a member. |
| `POST /api/bookclubs/:rkey/promote` | Admin JWT | Promotes a member to moderator. |
| `POST /api/bookclubs/:rkey/demote` | Admin JWT | Demotes a moderator. |
| `POST /api/bookclubs/:rkey/leave` | Any member JWT | Admin/mod/member leaves. Triggers succession if admin. |
| `POST /api/bookclubs/:rkey/claim` | Any user JWT | Claims admin of an adminless club. |
| `GET /api/bookclubs` | Public | Lists all clubs (paginated). |
| `GET /api/bookclubs/:rkey` | Public | Gets a single club with member list. |

### Auth Flow
- The client sends the user's AT Proto access JWT in the `Authorization` header
- The service verifies the JWT, extracts the caller's DID
- The service checks if the caller has the required role (admin/mod/member)
- The service writes records to its own PDS using its own service credentials

---

## Files to Create

### New Screens
- `src/screens/BookClubs/BookClubsScreen.tsx` — Main tab screen: list of clubs, search, create button
- `src/screens/BookClubs/BookClubScreen.tsx` — Single club view: members, progress, join request
- `src/screens/BookClubs/CreateBookClubDialog.tsx` — Creation form (name, book title, series, description)
- `src/screens/BookClubs/JoinBookClubDialog.tsx` — Join request form (which book, which chapter)
- `src/screens/BookClubs/ManageRequestsScreen.tsx` — Admin/mod view to approve/deny requests
- `src/screens/BookClubs/ManageMembersScreen.tsx` — Admin view to promote/demote/remove members
- `src/screens/BookClubs/ClaimAdminDialog.tsx` — Dialog for claiming an adminless club

### New State/Queries
- `src/state/queries/bookclubs.ts` — Hooks for bookclub operations
  - `useBookClubsQuery()` — `GET /api/bookclubs` (paginated list)
  - `useBookClubQuery(rkey)` — `GET /api/bookclubs/:rkey`
  - `useCreateBookClubMutation()` — `POST /api/bookclubs/create`
  - `useUpdateBookClubMutation()` — `PUT /api/bookclubs/:rkey`
  - `useJoinBookClubMutation()` — `createRecord` on member's PDS for `at.reads.bookclub.member` (pending status)
  - `useLeaveBookClubMutation()` — `POST /api/bookclubs/:rkey/leave` + delete own membership record
  - `useUpdateProgressMutation()` — `putRecord` on member's own PDS for `at.reads.bookclub.member`
  - `useApproveRequestMutation()` — `POST /api/bookclubs/:rkey/approve`
  - `useDenyRequestMutation()` — `POST /api/bookclubs/:rkey/deny`
  - `useRemoveMemberMutation()` — `POST /api/bookclubs/:rkey/remove`
  - `usePromoteModMutation()` — `POST /api/bookclubs/:rkey/promote`
  - `useDemoteModMutation()` — `POST /api/bookclubs/:rkey/demote`
  - `useClaimAdminMutation()` — `POST /api/bookclubs/:rkey/claim`

### New Icon
- `src/components/icons/BookClub.tsx` — Tab icon (book or group icon, filled/unfilled variants)

---

## Files to Modify

### Navigation — Add New Tab

#### `src/lib/routes/types.ts`
- Add to `CommonNavigatorParams`:
  ```typescript
  BookClubs: undefined
  BookClub: {rkey: string}
  BookClubManageRequests: {rkey: string}
  BookClubManageMembers: {rkey: string}
  ```
- Add to `BottomTabNavigatorParams`:
  ```typescript
  BookClubsTab: undefined
  ```

#### `src/routes.ts`
- Add route definitions:
  ```typescript
  BookClubs: '/bookclubs',
  BookClub: '/bookclubs/:rkey',
  BookClubManageRequests: '/bookclubs/:rkey/requests',
  BookClubManageMembers: '/bookclubs/:rkey/members',
  ```

#### `src/Navigation.tsx`
- Create `BookClubsTab` navigator: `const BookClubsTab = createNativeStackNavigatorWithAuth<BookClubsTabNavigatorParams>()`
- Add `BookClubsTabNavigator()` function (follow pattern from `SearchTabNavigator`, line 697)
- Add `<Tab.Screen name="BookClubsTab" ... />` in `TabsNavigator()` (line 659-672)
- Register BookClub-specific screens in the navigator

#### `src/view/shell/bottom-bar/BottomBar.tsx`
- Add `'BookClubs'` to `TabOptions` type (line 55)
- Add press handler: `const onPressBookClubs = useCallback(() => onPressTab('BookClubs'), [onPressTab])`
- Add `<Btn>` component with BookClub icon between existing tabs (lines 159-295)
- Import book club icon

#### `bskyweb/cmd/bskyweb/server.go`
- Add route: `e.GET("/bookclubs", server.WebGeneric)`
- Add route: `e.GET("/bookclubs/:rkey", server.WebGeneric)`
- Add route: `e.GET("/bookclubs/:rkey/requests", server.WebGeneric)`
- Add route: `e.GET("/bookclubs/:rkey/members", server.WebGeneric)`

---

## Architecture Patterns to Follow

### Record CRUD — Follow `list.ts` pattern
**File**: `src/state/queries/list.ts`
- Create: `agent.app.bsky.graph.list.create()` → we call readsat service API
- Update: `agent.com.atproto.repo.putRecord()` → we call readsat service API
- Delete: not available to users
- List: `agent.app.bsky.graph.getLists()` → we call readsat service API

### Membership — Follow `list-memberships.ts` pattern
**File**: `src/state/queries/list-memberships.ts`
- Join request: member writes `at.reads.bookclub.member` to their own PDS
- Approval: admin/mod calls readsat service API
- Optimistic cache updates with `queryClient.setQueryData()`

### Tab Navigator — Follow `MessagesTabNavigator` pattern
**File**: `src/Navigation.tsx` (lines 743-759)

---

## Admin Succession Flow

```
Creator creates club
  → Creator is admin
  → Creator invites Mod A (invitedAt: T1), Mod B (invitedAt: T2)

Creator leaves:
  → Mod A becomes admin (earliest invitedAt)
  → Mod B remains moderator

Mod A leaves:
  → Mod B becomes admin (next in line)

Mod B leaves:
  → Club has no admin, no moderators
  → Club enters "claimable" state
  → Any user can POST /api/bookclubs/:rkey/claim to become admin
```

The readsat service handles succession atomically — when processing a leave request from the admin, it updates the club record's `admin` field in the same operation.

---

## Discovery

Since club records all live on the readsat service PDS, discovery is straightforward:
- The service API provides paginated listing and search of all clubs
- Member lists are derived from `at.reads.bookclub.action` records (approved members) on the service PDS
- Individual member progress is fetched from each member's own PDS (`at.reads.bookclub.member` records)

This is much simpler than the previous hybrid approach since the service PDS is the single source of truth for club metadata and membership status.

---

## Notes
- The tab bar currently has 5 tabs (Home, Search, Messages, Notifications, Profile). Adding a 6th tab is fine on mobile but consider UX — may want to replace one or use a "More" pattern.
- Starter Packs (`src/state/queries/starter-packs.ts`) are the closest existing feature to book clubs — they have creation wizards, member lists, and sharing. Good pattern reference.
- Batch operations for member management can use `applyWrites` (see starter-packs.ts lines 204-215).
- The readsat service needs its own AT Proto account/DID and PDS credentials to write records on behalf of the service.
- Consider rate limiting on the service API to prevent abuse of club creation and claim endpoints.
