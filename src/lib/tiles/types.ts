export interface TileResourceSrc {
  $type: 'blob'
  ref: {$link: string} // CID
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
