# Publishing DASL Web Tiles to AT Protocol PDS

This documents how [linkna.me](https://linkna.me) publishes self-contained web tiles (HTML/CSS/images) to a user's AT Protocol PDS using the [DASL Web Tiles](https://dasl.ing) format (`ing.dasl.masl`). These tiles can be rendered by any DASL-compatible client (e.g. [reads.at](https://reads.at)) directly from the user's PDS — the publishing app is not involved at render time.

## Resources

| Resource | URL | Description |
|----------|-----|-------------|
| DASL | https://dasl.ing | Decentralized Application Standard Lexicon — the spec behind web tiles |
| Web Tiles Spec | https://webtil.es | Web Tiles documentation and specification |
| reads.at | https://reads.at | DASL-compatible client that renders tiles from PDS |
| pdsls.dev | https://pdsls.dev | PDS record inspector — verify your published tiles |
| AT Protocol | https://atproto.com | The underlying protocol |
| @atproto/api | https://www.npmjs.com/package/@atproto/api | TypeScript SDK for AT Protocol (blob uploads, record writes) |
| linkna.me | https://linkna.me | Reference implementation (this project) |
| Example tiles | https://pdsls.dev/at://did:plc:izttpdp3l6vss5crelt5kcux/ing.dasl.masl | Reference `ing.dasl.masl` records to inspect on PDS |

## Overview

A DASL Web Tile is an `ing.dasl.masl` record on a user's PDS. It contains:
- A **manifest** describing the tile (name, sizing, icon, background color)
- **Resources** — blobs (HTML, CSS, images) uploaded to the PDS and referenced by CID

The publishing flow:
1. Upload each resource (HTML, CSS, cover images, icons) as a blob via `com.atproto.repo.uploadBlob`
2. Build the manifest record referencing each blob
3. Write the record to the user's repo via `com.atproto.repo.putRecord`

## Record Format

The `ing.dasl.masl` record **must** wrap tile data inside a `tile` object:

```json
{
  "$type": "ing.dasl.masl",
  "tile": {
    "name": "Reading: The Great Gatsby",
    "description": "Books from Goodreads",
    "background_color": "#f5f0eb",
    "sizing": { "width": 640, "height": 320 },
    "icons": [{ "src": "/icon.png" }],
    "resources": {
      "/": {
        "src": {
          "$type": "blob",
          "ref": { "$link": "bafkrei..." },
          "size": 2048,
          "mimeType": "text/html"
        },
        "content-type": "text/html"
      },
      "/styles.css": {
        "src": {
          "$type": "blob",
          "ref": { "$link": "bafkrei..." },
          "size": 1024,
          "mimeType": "text/css"
        },
        "content-type": "text/css"
      },
      "/cover-0.jpg": {
        "src": {
          "$type": "blob",
          "ref": { "$link": "bafkrei..." },
          "size": 45000,
          "mimeType": "image/jpeg"
        },
        "content-type": "image/jpeg"
      },
      "/icon.png": {
        "src": {
          "$type": "blob",
          "ref": { "$link": "bafkrei..." },
          "size": 3200,
          "mimeType": "image/png"
        },
        "content-type": "image/png"
      }
    }
  },
  "createdAt": "2026-02-14T00:00:00.000Z"
}
```

Key details:
- `"/"` is the entry point (the HTML page)
- Resources reference each other via relative paths (e.g. `<link rel="stylesheet" href="/styles.css">`, `<img src="/cover-0.jpg">`)
- `mimeType` in `src` uses the actual MIME type returned by `uploadBlob` (not `application/octet-stream`)
- `content-type` is the MIME type for the resource
- `createdAt` is at the record root level, not inside `tile`

## OAuth Scopes

Your OAuth client needs these scopes to publish tiles:

```
repo:ing.dasl.masl blob:text/html blob:text/css
```

Add these alongside your existing scopes. If you're uploading images, you'll also need `blob:image/png blob:image/jpeg` etc. (you may already have these).

This goes in two places:
- Your OAuth configuration code (e.g. `configureOAuth` scope string)
- Your `client-metadata.json` file

**Existing users will need to re-authenticate** to grant the new scopes.

## Code

### Generic Tile Publisher (`publish-tile.ts`)

Handles blob uploads and record writing for any tile type:

```typescript
import { Agent } from '@atproto/api';

const TILE_COLLECTION = 'ing.dasl.masl';

export interface TileResource {
  path: string;
  data: Uint8Array;
  contentType: string;
}

interface TileManifestResource {
  src: {
    $type: 'blob';
    ref: { $link: string };
    size: number;
    mimeType: string;
  };
  'content-type': string;
}

interface Tile {
  name: string;
  description?: string;
  background_color?: string;
  icons?: Array<{ src: string }>;
  sizing?: { width: number; height: number };
  resources: Record<string, TileManifestResource>;
}

interface TileRecord {
  $type: 'ing.dasl.masl';
  tile: Tile;
  createdAt: string;
}

export async function publishTile(
  agent: Agent,
  did: string,
  rkey: string,
  name: string,
  resources: TileResource[],
  options?: {
    description?: string;
    backgroundColor?: string;
    sizing?: { width: number; height: number };
    iconPath?: string;
  },
): Promise<void> {
  const tile: Tile = {
    name,
    resources: {},
  };

  if (options?.description) tile.description = options.description;
  if (options?.backgroundColor) tile.background_color = options.backgroundColor;
  if (options?.sizing) tile.sizing = options.sizing;

  // Upload each resource as a blob
  for (const resource of resources) {
    const response = await agent.com.atproto.repo.uploadBlob(resource.data, {
      encoding: resource.contentType,
    });
    const blob = response.data.blob;

    tile.resources[resource.path] = {
      src: {
        $type: 'blob',
        ref: { $link: blob.ref.toString() },
        size: blob.size,
        mimeType: blob.mimeType,
      },
      'content-type': resource.contentType,
    };
  }

  // Add icon reference if specified
  if (options?.iconPath && tile.resources[options.iconPath]) {
    tile.icons = [{ src: options.iconPath }];
  }

  const record: TileRecord = {
    $type: 'ing.dasl.masl',
    tile,
    createdAt: new Date().toISOString(),
  };

  // Write the manifest record to the user's PDS
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: TILE_COLLECTION,
    rkey,
    record: record as unknown as Record<string, unknown>,
  });
}

export async function deleteTile(
  agent: Agent,
  did: string,
  rkey: string,
): Promise<void> {
  try {
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection: TILE_COLLECTION,
      rkey,
    });
  } catch {
    // Record might not exist, that's fine
  }
}
```

### Tile Orchestrator (`goodreads-tile-publisher.ts`)

Fetches external assets, generates HTML/CSS, and calls `publishTile`:

```typescript
import { Agent } from '@atproto/api';
import type { WidgetGoodreads, ThemeConfig } from '@/lib/schemas/linkinbio';
import { generateGoodreadsTileHtml, generateGoodreadsTileCss, getTileSizing } from './goodreads-tile';
import { publishTile, deleteTile, type TileResource } from './publish-tile';

const GOODREADS_TILE_RKEY = 'goodreads';

async function fetchCoverImage(coverUrl: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(coverUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    return { data: new Uint8Array(buffer), contentType };
  } catch {
    return null;
  }
}

async function fetchIcon(): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch('/icons/goodreads.png');
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    return { data: new Uint8Array(buffer), contentType };
  } catch {
    return null;
  }
}

export async function publishGoodreadsTile(
  agent: Agent,
  did: string,
  card: WidgetGoodreads,
  themeConfig?: ThemeConfig,
): Promise<void> {
  const resources: TileResource[] = [];
  const books = card.books;
  const readBooks = card.readBooks || [];
  const size = (card.size || '1x1') as '1x1' | '1x2' | '2x2';

  // Fetch cover images via proxy
  const coverPathMap = new Map<number, string>();
  let coverIndex = 0;
  for (let i = 0; i < books.length && coverIndex < 6; i++) {
    if (books[i].coverUrl) {
      const result = await fetchCoverImage(books[i].coverUrl!);
      if (result) {
        const ext = result.contentType.includes('png') ? 'png' : 'jpg';
        const path = `/cover-${coverIndex}.${ext}`;
        resources.push({ path, data: result.data, contentType: result.contentType });
        coverPathMap.set(i, path);
        coverIndex++;
      }
    }
  }

  // Fetch read book covers
  const readCoverPathMap = new Map<number, string>();
  for (let i = 0; i < readBooks.length && i < 6; i++) {
    if (readBooks[i].coverUrl) {
      const result = await fetchCoverImage(readBooks[i].coverUrl!);
      if (result) {
        const ext = result.contentType.includes('png') ? 'png' : 'jpg';
        const path = `/read-cover-${i}.${ext}`;
        resources.push({ path, data: result.data, contentType: result.contentType });
        readCoverPathMap.set(i, path);
      }
    }
  }

  // Fetch icon
  const icon = await fetchIcon();
  if (icon) {
    resources.push({ path: '/icon.png', data: icon.data, contentType: icon.contentType });
  }

  // Generate CSS
  const css = generateGoodreadsTileCss();
  resources.push({
    path: '/styles.css',
    data: new TextEncoder().encode(css),
    contentType: 'text/css',
  });

  // Generate HTML
  const html = generateGoodreadsTileHtml(
    books, readBooks, card.shelf, size,
    coverPathMap, readCoverPathMap, themeConfig,
  );
  resources.push({
    path: '/',
    data: new TextEncoder().encode(html),
    contentType: 'text/html',
  });

  // Determine tile name
  const currentBook = books[0];
  const tileName = currentBook
    ? `Reading: ${currentBook.title}`
    : 'My Bookshelf';

  await publishTile(agent, did, GOODREADS_TILE_RKEY, tileName, resources, {
    description: 'Books from Goodreads',
    backgroundColor: themeConfig?.cardBackgroundColor || '#f5f0eb',
    sizing: getTileSizing(size),
    iconPath: icon ? '/icon.png' : undefined,
  });
}

export async function deleteGoodreadsTile(
  agent: Agent,
  did: string,
): Promise<void> {
  await deleteTile(agent, did, GOODREADS_TILE_RKEY);
}
```

### HTML/CSS Template Generator (`goodreads-tile.ts`)

Generates self-contained HTML and CSS for the tile. The HTML references resources via relative paths (`/styles.css`, `/cover-0.jpg`, `/icon.png`) which DASL clients resolve against the tile's blob resources.

```typescript
import type { GoodreadsBook, ThemeConfig } from '@/lib/schemas/linkinbio';

type WidgetSize = '1x1' | '1x2' | '2x2';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '\u2026';
}

export function getTileSizing(size: WidgetSize): { width: number; height: number } {
  switch (size) {
    case '1x1': return { width: 320, height: 320 };
    case '1x2': return { width: 640, height: 320 };
    case '2x2': return { width: 640, height: 640 };
    default: return { width: 320, height: 320 };
  }
}

// The HTML wrapper includes a CSP meta tag for security
function wrapHtml(body: string, bgColor: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; form-action 'none';">
  <link rel="stylesheet" href="/styles.css">
  <style>body{background:${bgColor};}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function generateGoodreadsTileHtml(
  books: GoodreadsBook[],
  readBooks: GoodreadsBook[],
  shelf: string,
  size: WidgetSize,
  coverPathMap: Map<number, string>,
  readCoverPathMap: Map<number, string>,
  themeConfig?: ThemeConfig,
): string {
  const bgColor = themeConfig?.cardBackgroundColor || '#f5f0eb';
  const textColor = themeConfig?.cardTextColor || '#2D2D2D';
  const fontFamily = themeConfig?.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Build HTML based on tile size (1x1, 1x2, 2x2)
  // Use wrapHtml() to produce the full <!DOCTYPE html> document
  // Reference images via their resource paths: /cover-0.jpg, /read-cover-0.jpg, /icon.png
  // Reference stylesheet via /styles.css

  // ... (layout-specific HTML generation)
}

export function generateGoodreadsTileCss(): string {
  // Returns a complete CSS string for the tile
  // Styles for: .tile-container, .header, .single-book, .single-cover,
  //   .left-col/.right-col (split layout), .read-page/.pagination (paginated lists),
  //   .gallery (grid layout), .cover-placeholder, etc.
}
```

The full implementation supports three layouts:
- **1x1** — Single book cover with title and author
- **1x2** — Split view: "Currently Reading" on the left, paginated "Previously Read" list on the right (with prev/next arrows, dot indicators, touch swipe)
- **2x2** — Gallery grid of book covers

### Image Proxy (`api/image-proxy/route.ts`)

External image CDNs (Goodreads, Amazon) don't allow cross-origin fetches from the browser. This edge-compatible proxy route fetches the images server-side:

```typescript
export const runtime = 'edge';

const ALLOWED_HOSTS = [
  'i.gr-assets.com',
  'images.gr-assets.com',
  'images-na.ssl-images-amazon.com',
];
const FETCH_TIMEOUT = 5000;
const CACHE_MAX_AGE = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) return new Response('Missing url parameter', { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return new Response('Invalid URL', { status: 400 }); }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response('Host not allowed', { status: 403 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinknameBot/1.0)' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return new Response('Failed to fetch image', { status: 502 });

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const body = await response.arrayBuffer();

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      },
    });
  } catch {
    clearTimeout(timeoutId);
    return new Response('Request timed out', { status: 504 });
  }
}
```

## Integration

Tile operations are fire-and-forget — the primary action (saving the widget config) always completes regardless of whether tile publishing succeeds:

```typescript
import { publishGoodreadsTile, deleteGoodreadsTile } from '@/lib/tiles/goodreads-tile-publisher';

// After saving widget config:
const agent = await getAgentForSession(session);

// Publish (on add, edit, refresh, enable, resize)
publishGoodreadsTile(agent, session.did, card, themeConfig).catch(err => {
  console.warn('Failed to publish tile:', err);
});

// Delete (on remove, disable)
deleteGoodreadsTile(agent, session.did).catch(err => {
  console.warn('Failed to delete tile:', err);
});
```

Hook into these user actions:
| Action | Tile Operation |
|--------|---------------|
| Add widget | `publishGoodreadsTile()` |
| Edit widget | `publishGoodreadsTile()` (republish) |
| Refresh data | `publishGoodreadsTile()` (republish) |
| Enable widget | `publishGoodreadsTile()` |
| Disable widget | `deleteGoodreadsTile()` |
| Delete widget | `deleteGoodreadsTile()` |
| Resize widget | `publishGoodreadsTile()` (republish with new sizing) |

## Gotchas

1. **The `tile` wrapper is required.** Putting `name`, `resources` etc. at the record root level will cause a 400 error from the PDS. Everything goes inside `record.tile`.

2. **Use actual MIME types.** The `mimeType` field in the blob `src` should be the real MIME type returned by `uploadBlob` (e.g. `image/jpeg`, `text/html`), not `application/octet-stream`.

3. **`createdAt` goes at the record root**, not inside `tile`.

4. **Client-side publishing only.** AT Protocol OAuth uses DPoP-bound tokens that only exist in the browser. All PDS writes must happen client-side.

5. **rkey strategy.** Use a fixed rkey per tile type (e.g. `'goodreads'`) with `putRecord` so updates overwrite the previous version. This means one tile per type per user.

6. **CORS for external images.** If your tile includes images from external CDNs, you'll need a server-side proxy to fetch them before uploading as blobs.

7. **Edge runtime constraints.** If deploying on Cloudflare Pages or similar edge runtimes, native modules like `sharp` are unavailable. Upload images as-is.

## Verification

After publishing, verify the record exists:
```
https://pdsls.dev/at://<did>/ing.dasl.masl/<rkey>
```

Or via API:
```bash
curl "https://<pds-host>/xrpc/com.atproto.repo.getRecord?repo=<did>&collection=ing.dasl.masl&rkey=<rkey>"
```

The tile should render on any DASL-compatible client like [reads.at](https://reads.at).
