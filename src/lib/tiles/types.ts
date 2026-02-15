export interface TileResourceSrc {
  $type: 'blob'
  // At runtime, the SDK transforms this into a CID object (BlobRef class).
  // Use String(resource.src.ref) to reliably extract the CID string.
  ref: {$link: string} | {toString(): string}
  size: number
  mimeType: string
}

export interface TileResource {
  src: TileResourceSrc
  'content-type': string // Actual MIME type (e.g. 'text/html', 'image/jpeg')
}

export interface TileManifest {
  name: string
  resources: Record<string, TileResource> // "/" entry required
  description?: string
  sizing?: {width: number; height: number}
  background_color?: string
  theme_color?: string
  icons?: Array<{src: string; sizes?: string}>
}

// The AT Protocol record wraps the manifest in a `tile` field
export interface TileMaslRecord {
  $type: 'ing.dasl.masl'
  tile: TileManifest
  createdAt: string
}
