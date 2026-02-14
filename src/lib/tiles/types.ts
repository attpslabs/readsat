export interface TileResourceSrc {
  $type: 'blob'
  ref: {$link: string} // CID
  size: number
  mimeType: string // Always 'application/octet-stream' per DASL spec
}

export interface TileResource {
  src: TileResourceSrc
  'content-type': string // Actual MIME type (e.g. 'text/html', 'image/jpeg')
}

export interface TileManifest {
  $type: 'ing.dasl.masl'
  name: string
  resources: Record<string, TileResource> // "/" entry required
  description?: string
  sizing?: {width: number; height: number}
  background_color?: string
  theme_color?: string
  icons?: Array<{src: string; sizes?: string}>
}
