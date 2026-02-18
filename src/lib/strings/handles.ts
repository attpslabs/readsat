// Regex from the go implementation
// https://github.com/bluesky-social/indigo/blob/main/atproto/syntax/handle.go#L10
import {BSKY_SERVICE, SELF_SURF_SERVICE} from '#/lib/constants'
import {forceLTR} from '#/lib/strings/bidi'

const VALIDATE_REGEX =
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

export const MAX_SERVICE_HANDLE_LENGTH = 18
export const READS_AT_SUFFIX = '.reads.at'

export function makeValidHandle(str: string): string {
  if (str.length > 20) {
    str = str.slice(0, 20)
  }
  str = str.toLowerCase()
  return str.replace(/^[^a-z0-9]+/g, '').replace(/[^a-z0-9-]/g, '')
}

export function createFullHandle(name: string, domain: string): string {
  name = (name || '').replace(/[.]+$/, '')
  domain = (domain || '').replace(/^[.]+/, '')
  return `${name}.${domain}`
}

export function isInvalidHandle(handle: string): boolean {
  return handle === 'handle.invalid'
}

export function sanitizeHandle(
  handle: string,
  prefix = '',
  forceLeftToRight = true,
): string {
  const lowercasedWithPrefix = `${prefix}${handle.toLocaleLowerCase()}`
  return isInvalidHandle(handle)
    ? '⚠Invalid Handle'
    : forceLeftToRight
      ? forceLTR(lowercasedWithPrefix)
      : lowercasedWithPrefix
}

export function displayHandle(handle: string): string {
  if (isInvalidHandle(handle)) return handle
  if (
    handle.length > READS_AT_SUFFIX.length &&
    handle.endsWith(READS_AT_SUFFIX)
  ) {
    return handle.slice(0, -READS_AT_SUFFIX.length)
  }
  return handle
}

export function expandHandle(shortHandle: string): string {
  if (shortHandle.startsWith('did:')) return shortHandle
  if (!shortHandle.includes('.')) {
    return `${shortHandle}${READS_AT_SUFFIX}`
  }
  return shortHandle
}

export function isReadsAtHandle(handle: string): boolean {
  return handle.endsWith(READS_AT_SUFFIX)
}

export function resolveServiceFromHandle(identifier: string): string {
  const id = identifier.trim().toLowerCase()
  if (id.includes('@')) return SELF_SURF_SERVICE
  if (!id.includes('.')) return SELF_SURF_SERVICE
  const domain = id.split('.').slice(1).join('.')
  if (domain.endsWith('self.surf') || domain === 'self.surf')
    return SELF_SURF_SERVICE
  if (domain.endsWith('bsky.social') || domain === 'bsky.social')
    return BSKY_SERVICE
  return `https://${domain}`
}

export interface IsValidHandle {
  handleChars: boolean
  hyphenStartOrEnd: boolean
  frontLengthNotTooShort: boolean
  frontLengthNotTooLong: boolean
  totalLength: boolean
  overall: boolean
}

// More checks from https://github.com/bluesky-social/atproto/blob/main/packages/pds/src/handle/index.ts#L72
export function validateServiceHandle(
  str: string,
  userDomain: string,
): IsValidHandle {
  const fullHandle = createFullHandle(str, userDomain)

  const results = {
    handleChars:
      !str || (VALIDATE_REGEX.test(fullHandle) && !str.includes('.')),
    hyphenStartOrEnd: !str.startsWith('-') && !str.endsWith('-'),
    frontLengthNotTooShort: str.length >= 3,
    frontLengthNotTooLong: str.length <= MAX_SERVICE_HANDLE_LENGTH,
    totalLength: fullHandle.length <= 253,
  }

  return {
    ...results,
    overall: !Object.values(results).includes(false),
  }
}
