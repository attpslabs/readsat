# Task: Implement Books Tab for Reads

## Overview

Add a new "Books" tab to the Reads app (reads.at) that displays a feed of books from BookHive's catalog. This tab will allow users to discover and browse books, view book details, and add books to their library.

## Context

- **Reads** (reads.at) is a fork of the Bluesky social-app, customized for book readers
- **BookHive** (bookhive.buzz) is an AT Protocol app that indexes books and provides a decentralized Goodreads alternative
- We're using BookHive's XRPC API for book data and their `buzz.bookhive.book` lexicon for user library data
- Users can add books to their library, and the data will be interoperable with BookHive

## Requirements

### 1. Add Books Tab to Navigation

Add a "Books" icon/tab to the left sidebar navigation, positioned after the existing tabs (Home, Search, Notifications, etc.)

- Icon: Use a book icon (📚 or similar from the existing icon set)
- Label: "Books"
- Route: `/books`

### 2. Books Feed (Center Column)

Create a feed that displays books from BookHive's catalog.

**Initial Load:**
- Fetch books using `buzz.bookhive.searchBooks` with a broad query or empty/wildcard search
- Display 25 books initially (default limit)
- Implement infinite scroll pagination using the `offset` parameter

**Book Card Component:**
Each book in the feed should display:
- Cover image (use `thumbnail` for feed, `cover` for detail)
- Title
- Author(s)
- Average rating (convert from 0-1000 scale to 5-star display)
- Number of ratings

**Book Card Interactions:**
- Tap/click → Navigate to book detail page (`/books/{hiveId}`)
- Long press or menu → Quick actions (Add to library, Share)

### 3. Book Detail Page

Route: `/books/{hiveId}`

Fetch book data using `buzz.bookhive.getBook?id={hiveId}`

**Display:**
- Full-size cover image
- Title
- Author(s)
- Description (rendered from HTML, sanitized)
- Rating with count
- Series info (if available)
- Metadata: Publisher, Publication Year, Page Count, ISBN
- Reviews from other users
- Comments/Buzz activity

**User Actions:**
- "Add to Library" button → Opens status picker
- Status options: Want to Read, Reading, Finished, Abandoned, Owned
- Star rating (1-5 stars, stored as 1-10)
- Write review

### 4. Search Within Books Tab

Add a search bar at the top of the Books feed.

- Placeholder: "Search books..."
- On submit → Call `buzz.bookhive.searchBooks?q={query}`
- Display results in the same feed format
- Show "No results found" state when empty

### 5. Writing User Book Data

When a user adds a book to their library, write a `buzz.bookhive.book` record to their PDS:

```typescript
// Collection: buzz.bookhive.book
// Key: TID (generate using @atproto/common-web tid)

interface BuzzBookhiveBook {
  title: string;           // Required, max 512 chars
  authors: string;         // Required, tab-separated, max 2048 chars
  hiveId: string;          // Required, links to BookHive catalog
  createdAt: string;       // Required, ISO datetime
  status?: string;         // Optional, one of the status tokens
  stars?: number;          // Optional, 1-10
  review?: string;         // Optional, max 15000 graphemes
  cover?: Blob;            // Optional, image/png or image/jpeg, max 1MB
  startedAt?: string;      // Optional, ISO datetime
  finishedAt?: string;     // Optional, ISO datetime
  bookProgress?: {
    updatedAt: string;
    percent?: number;      // 0-100
    totalPages?: number;
    currentPage?: number;
  };
}
```

**Status Tokens:**
- `buzz.bookhive.defs#wantToRead`
- `buzz.bookhive.defs#reading`
- `buzz.bookhive.defs#finished`
- `buzz.bookhive.defs#abandoned`
- `buzz.bookhive.defs#owned`

## API Reference

### BookHive XRPC Endpoints

Base URL: `https://bookhive.buzz/xrpc/`

#### Search Books
```
GET /xrpc/buzz.bookhive.searchBooks
Parameters:
  - q: string (required) - Search query
  - limit: integer (optional, default 25, max 100)
  - offset: integer (optional) - Pagination offset

Response:
{
  "offset": number,
  "books": HiveBook[]
}
```

#### Get Book Details
```
GET /xrpc/buzz.bookhive.getBook
Parameters (at least one required):
  - id: string - Hive ID
  - isbn: string - ISBN-10
  - isbn13: string - ISBN-13
  - goodreadsId: string

Response:
{
  "book": HiveBook,
  "reviews": Review[],
  "comments": Comment[],
  "activity": Activity[],
  "status": string | null,      // User's status if authenticated
  "stars": number | null,       // User's rating
  "review": string | null       // User's review
}
```

#### Get User Profile/Library
```
GET /xrpc/buzz.bookhive.getProfile
Parameters:
  - did: string - User's DID
  - handle: string - User's handle

Response:
{
  "profile": Profile,
  "books": UserBook[],
  "activity": Activity[]
}
```

### HiveBook Type
```typescript
interface HiveBook {
  id: string;
  title: string;
  authors: string;           // Tab-separated
  thumbnail: string;         // URL to thumbnail
  cover?: string;            // URL to full cover
  description?: string;      // HTML content
  rating?: number;           // 0-1000 scale
  ratingsCount?: number;
  source?: string;           // e.g., "Goodreads"
  sourceUrl?: string;
  sourceId?: string;
  genres?: string;           // JSON array as string
  series?: string;           // JSON object as string
  meta?: string;             // JSON object with publisher, year, pages, etc.
  identifiers?: {
    hiveId: string;
    isbn10?: string;
    isbn13?: string;
    goodreadsId?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

## UI/UX Guidelines

### Feed Layout
- Match the existing Bluesky feed layout style
- Book cards should be visually distinct from post cards
- Cover images should be prominently displayed (left side or top)
- Ensure covers load quickly (use thumbnail URLs in feed)

### Loading States
- Skeleton loaders for book cards while fetching
- Pull-to-refresh on mobile
- "Load more" or infinite scroll for pagination

### Empty States
- No books found (search): "No books match your search"
- Error state: "Couldn't load books. Tap to retry."

### Responsive Design
- Mobile: Single column, full-width book cards
- Tablet/Desktop: Center column with standard width (matching feed)

## Future Features (Do Not Implement Now)

These are planned for future tasks:

1. **Genre Filtering (Right Sidebar)**
   - Right nav bar with genre list
   - Click genre → Filter books by that genre
   - Requires BookHive API endpoint (pending)

2. **User's Library Tab**
   - View own books grouped by status
   - Reading progress tracking

3. **Social Features**
   - See what friends are reading
   - Book recommendations based on follows

## Technical Notes

### File Locations (Bluesky social-app structure)
- Navigation: `src/view/shell/` (check existing nav implementation)
- Screens: `src/view/screens/`
- Components: `src/view/com/`
- API calls: `src/state/queries/` or similar

### Dependencies
- Use existing HTTP/fetch utilities from the codebase
- Use existing UI components where possible (buttons, cards, avatars)
- Follow existing patterns for routing and state management

### Testing
- Test search with various queries
- Test pagination (scroll to load more)
- Test book detail navigation
- Test adding book to library (verify record created on PDS)
- Test on both mobile and web

## Acceptance Criteria

- [ ] Books tab appears in navigation
- [ ] Books feed loads and displays book cards
- [ ] Infinite scroll pagination works
- [ ] Search filters the book list
- [ ] Tapping a book navigates to detail page
- [ ] Book detail page shows all book info
- [ ] User can add book to library with status
- [ ] User can rate a book
- [ ] Book data is written to user's PDS as `buzz.bookhive.book` record
- [ ] Loading and error states are handled gracefully
- [ ] UI is responsive (mobile + desktop)