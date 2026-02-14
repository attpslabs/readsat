import {type TileManifest, type TileResource} from './types'

/**
 * Fetch a blob from a PDS via com.atproto.sync.getBlob and return as base64.
 */
async function fetchBlobAsBase64(
  serviceUrl: string,
  did: string,
  cid: string,
): Promise<string> {
  const url = `${serviceUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Blob fetch failed: ${response.status}`)
  }
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Extract base64 portion after the data URI prefix
      const base64 = result.split(',')[1]
      if (base64) {
        resolve(base64)
      } else {
        reject(new Error('Failed to encode blob as base64'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Build a data URI from a resource's base64 content and its content-type.
 * Uses resource['content-type'] (actual MIME), not resource.src.mimeType
 * (which is always 'application/octet-stream' per DASL spec).
 */
function buildDataUri(base64: string, resource: TileResource): string {
  return `data:${resource['content-type']};base64,${base64}`
}

/**
 * Replace path references in HTML with inlined data URIs.
 * Handles: src="/path", href="/path", src="./path", href="./path", url(/path)
 */
function inlineResourceRefs(
  html: string,
  resources: Map<string, string>,
): string {
  let result = html

  for (const [path, dataUri] of resources) {
    if (path === '/') continue

    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // src="/path" or href="/path" (with or without ./ prefix)
    result = result.replace(
      new RegExp(`(src|href)=["'](\\.)?${escapedPath}["']`, 'g'),
      `$1="${dataUri}"`,
    )
    // url(/path) in CSS (with or without quotes)
    result = result.replace(
      new RegExp(`url\\(["']?(\\.)?${escapedPath}["']?\\)`, 'g'),
      `url("${dataUri}")`,
    )
  }

  return result
}

/**
 * Wrap HTML content in a secure shell with CSP enforcement.
 */
function wrapInSecureShell(html: string, manifest: TileManifest): string {
  const bgColor = manifest.background_color || '#ffffff'

  const csp = [
    "default-src 'self' blob: data:",
    "script-src 'self' blob: data: 'unsafe-inline' 'wasm-unsafe-eval'",
    "connect-src 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "manifest-src 'none'",
  ].join('; ')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<style>html, body { margin: 0; padding: 0; overflow: hidden; background: ${bgColor}; }</style>
</head>
<body>
${html}
</body>
</html>`
}

/**
 * Load a tile's content by fetching all resources from PDS, inlining them,
 * and producing a self-contained HTML string ready for sandboxed rendering.
 */
export async function loadTileContent(
  manifest: TileManifest,
  did: string,
  serviceUrl: string,
): Promise<string> {
  const entries = Object.entries(manifest.resources)

  // Fetch all resources in parallel
  const results = await Promise.allSettled(
    entries.map(async ([path, resource]) => {
      const base64 = await fetchBlobAsBase64(
        serviceUrl,
        did,
        resource.src.ref.$link,
      )
      return {path, dataUri: buildDataUri(base64, resource)}
    }),
  )

  const resources = new Map<string, string>()
  for (const result of results) {
    if (result.status === 'fulfilled') {
      resources.set(result.value.path, result.value.dataUri)
    }
  }

  // Root resource is required
  const rootDataUri = resources.get('/')
  if (!rootDataUri) {
    throw new Error('Root resource "/" not found or failed to load')
  }

  // Decode root HTML from base64 data URI
  const base64Part = rootDataUri.split(',')[1]
  if (!base64Part) {
    throw new Error('Failed to decode root resource')
  }
  const rootHtml = atob(base64Part)

  // Inline all sub-resource references
  const inlinedHtml = inlineResourceRefs(rootHtml, resources)

  return wrapInSecureShell(inlinedHtml, manifest)
}
