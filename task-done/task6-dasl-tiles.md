# Task 6: DASL Tiles Support

## Objective
Implement Web Tiles rendering support by extending external embed detection. When a URL serves a DASL tile manifest, render it as an interactive sandboxed tile instead of a static OG card. Non-tile URLs continue to render as normal link cards.

## Background

### What are Web Tiles?
Web Tiles are composable web documents/apps defined by the DASL specification at https://dasl.ing/tiles.html.
- **No runtime network access** — all resources must be pre-declared in the manifest
- **Content-addressed** — resources identified by CID (content hash)
- **Sandboxed** — strict CSP prevents data exfiltration
- **AT Protocol native** — tiles can be stored/referenced via `ing.dasl.masl` lexicon

### Why Extend External Embeds?
Rather than creating a new `app.bsky.embed.tile` lexicon (requires ecosystem-wide adoption), we extend the existing `app.bsky.embed.external` flow:
- When fetching URL metadata, detect if the URL serves a tile manifest
- If tile-capable, render as interactive tile instead of static OG card
- Graceful degradation: other clients still see the OG fallback

---

## Current Embed System (for context)

### Link Metadata Flow
1. **Text Input** → User pastes URL → `src/view/com/composer/text-input/TextInput.tsx` detects facets via `RichText.detectFacetsWithoutResolution()` (line 77)
2. **URL Suggestion** → `src/view/com/composer/text-input/text-input-util.ts` `suggestLinkCardUri()` (lines 8-83) triggers when URL is stable
3. **Composer Handler** → `src/view/com/composer/Composer.tsx` `onNewLink()` (lines 1341-1346) dispatches `embed_add_uri`
4. **Link Resolution** → `src/state/queries/resolve-link.ts` `useResolveLinkQuery()` → calls `resolveLink()` in `src/lib/api/resolve.ts` (lines 80-187)
5. **Metadata Fetch** → `src/lib/link-meta/link-meta.ts` `getLinkMeta()` (lines 27-104) fetches via proxy (`cardyb.bsky.app/v1/extract?url=`)
6. **Composer Preview** → `src/view/com/composer/ExternalEmbed.tsx` renders link card
7. **Feed Rendering** → `src/components/Post/Embed/index.tsx` `Embed()` (lines 48-79) → `MediaEmbed()` (lines 81-123) → `ExternalEmbed` for `'link'` type

### Key Types
**`src/lib/link-meta/link-meta.ts`** (lines 18-25):
```typescript
export interface LinkMeta {
  error?: string
  likelyType: LikelyType
  url: string
  title?: string
  description?: string
  image?: string
}
```

### Key Components
| Component | File | Purpose |
|---|---|---|
| `ExternalEmbed` | `src/components/Post/Embed/ExternalEmbed/index.tsx` (lines 24-181) | Renders OG card in feed |
| `ExternalEmbedLink` | `src/view/com/composer/ExternalEmbed.tsx` (lines 75-156) | Renders link preview in composer |
| `Embed` | `src/components/Post/Embed/index.tsx` (lines 48-79) | Parent switch for embed types |
| `MediaEmbed` | `src/components/Post/Embed/index.tsx` (lines 81-123) | Routes media to specific components |

### Link Meta Proxy
**`src/lib/constants.ts`** (lines 105-116):
- Production: `https://cardyb.bsky.app/v1/extract?url=`
- Staging: `https://cardyb.staging.bsky.dev/v1/extract?url=`

---

## Implementation

### Phase 1: Tile Detection

#### 1.1 Add tile manifest detection
**File to modify**: `src/lib/link-meta/link-meta.ts`

Add tile detection to the `getLinkMeta()` function. After fetching OG metadata, check for tile capability:

```typescript
async function detectTileCapability(url: string): Promise<TileManifest | null> {
  try {
    const wellKnownUrl = new URL('/.well-known/tile.json', url);
    const response = await fetch(wellKnownUrl.toString());
    if (response.ok) {
      const manifest = await response.json();
      if (manifest.name && manifest.resources && manifest.resources['/']) {
        return manifest as TileManifest;
      }
    }
  } catch (e) {
    // Not tile-capable, fall through
  }
  return null;
}
```

#### 1.2 Extend LinkMeta type
**File to modify**: `src/lib/link-meta/link-meta.ts`

```typescript
export interface TileManifest {
  name: string;
  resources: Record<string, {
    src: { $type: 'blob'; ref: { $link: string }; size: number; mimeType: string };
    'content-type': string;
  }>;
  description?: string;
  icons?: Array<{ src: string; sizes?: string }>;
  sizing?: { width: number; height: number };
}

export interface LinkMeta {
  error?: string
  likelyType: LikelyType
  url: string
  title?: string
  description?: string
  image?: string
  tile?: {
    manifest: TileManifest;
    endpoint: string;
  };
}
```

#### 1.3 Update resolve-link to pass tile data through
**File to modify**: `src/lib/api/resolve.ts`

In `resolveExternal()` (lines 203-215), pass `tile` field from `getLinkMeta()` result into the `ResolvedExternalLink`.

**File to modify**: `src/lib/api/resolve.ts` — `ResolvedExternalLink` type (lines 31-37) — add `tile?` field.

---

### Phase 2: Tile Renderer Component

#### 2.1 Create native tile renderer
**New file**: `src/view/com/util/post-embeds/TileEmbed.tsx`

- Uses `react-native-webview` `<WebView>` with strict sandboxing
- Fetches root resource + all manifest resources, inlines them as data URIs
- Injects CSP meta tag: `connect-src 'none'`
- Sets `originWhitelist={['about:blank']}`, `incognito={true}`, `onShouldStartLoadWithRequest={() => false}`

#### 2.2 Create web tile renderer
**New file**: `src/view/com/util/post-embeds/TileEmbed.web.tsx`

- Uses sandboxed `<iframe>` with `sandbox="allow-scripts allow-same-origin"`
- Content loaded as blob URL
- No `allow-top-navigation` or `allow-popups`

#### 2.3 Tile loading/inlining utility
**New file**: `src/lib/tiles/loader.ts`

```typescript
export async function loadTileContent(manifest: TileManifest, endpoint: string): Promise<string>
export async function inlineResources(html: string, manifest: TileManifest, endpoint: string): Promise<string>
```

- Fetches root HTML from manifest
- Fetches all resources, converts to data URIs
- Replaces path references in HTML with inlined data URIs
- Wraps in CSP-enforced HTML shell

---

### Phase 3: Integration with Post Embeds

#### 3.1 Update ExternalEmbed
**File to modify**: `src/components/Post/Embed/ExternalEmbed/index.tsx`

In the `ExternalEmbed` component (lines 24-181), add tile detection before the standard OG card rendering:

```typescript
if (link.tile) {
  return <TileEmbed manifest={link.tile.manifest} endpoint={link.tile.endpoint} />;
}
// ... existing OG card rendering
```

#### 3.2 Update composer preview
**File to modify**: `src/view/com/composer/ExternalEmbed.tsx`

In `ExternalEmbedLink` (lines 75-156), show tile preview if tile data is present. Could show a static preview with a "Tile" badge, or render the actual tile.

---

### Phase 4: Caching & Performance

#### 4.1 Cache tile manifests
**New file**: `src/lib/tiles/cache.ts`

- In-memory cache with 5-minute TTL
- Keyed by URL
- Prevents re-fetching manifests for the same URL

#### 4.2 Lazy load tile content
**In**: `TileEmbed.tsx` / `TileEmbed.web.tsx`

- Use intersection observer / `onLayout` to detect when tile scrolls into view
- Only fetch and render tile resources when visible
- Show skeleton placeholder until loaded

---

## Security Considerations

1. **CSP Enforcement**: Tiles MUST NOT make network requests. CSP must include `connect-src 'none'`
2. **Blob URLs**: All tile resources fetched and served as blobs. Tile never touches the network at runtime.
3. **Sandbox Attributes**: iframe uses `sandbox="allow-scripts allow-same-origin"` — no `allow-top-navigation` or `allow-popups`
4. **Origin Isolation**: Each tile renders in an opaque origin to prevent cross-tile data access
5. **Navigation Prevention**: Both WebView and iframe prevent any navigation attempts

---

## Files Summary

### New Files
| File | Purpose |
|---|---|
| `src/view/com/util/post-embeds/TileEmbed.tsx` | Native tile renderer (WebView) |
| `src/view/com/util/post-embeds/TileEmbed.web.tsx` | Web tile renderer (iframe) |
| `src/lib/tiles/loader.ts` | Tile content fetching + resource inlining |
| `src/lib/tiles/cache.ts` | Tile manifest caching |

### Modified Files
| File | Change |
|---|---|
| `src/lib/link-meta/link-meta.ts` | Add `TileManifest` type, `tile?` to `LinkMeta`, `detectTileCapability()` function |
| `src/lib/api/resolve.ts` | Add `tile?` to `ResolvedExternalLink`, pass through in `resolveExternal()` |
| `src/components/Post/Embed/ExternalEmbed/index.tsx` | Check for `link.tile` before rendering OG card |
| `src/view/com/composer/ExternalEmbed.tsx` | Show tile preview badge in composer |

---

## Testing Checklist

- [ ] Tile detection works for `linkna.me/*` URLs
- [ ] Tile renders correctly on iOS (WebView)
- [ ] Tile renders correctly on Android (WebView)
- [ ] Tile renders correctly on Web (iframe)
- [ ] Non-tile URLs still show normal OG cards
- [ ] Tiles cannot make external network requests (CSP enforced)
- [ ] Tiles cannot navigate away from sandbox
- [ ] Performance: tiles lazy-load when scrolling into view
- [ ] Graceful degradation: broken tiles show fallback OG card
- [ ] Manifest caching prevents redundant fetches

---

## Future Enhancements
- Support `ing.dasl.masl` lexicon for tiles stored directly on AT Protocol
- Tile-to-tile communication (per DASL spec roadmap)
- User preference to disable tiles globally
- Tile caching in device storage
