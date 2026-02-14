/**
 * Derives an AT Protocol handle from a URL, if the URL is tile-eligible.
 * Currently only supports linkna.me URLs.
 *
 * linkna.me/username → username.self.surf
 */
export function getTileHandle(url: string): string | null {
  try {
    const urlp = new URL(url)
    if (urlp.hostname === 'linkna.me') {
      const username = urlp.pathname.split('/')[1]
      if (username && !username.includes('.')) {
        return `${username}.self.surf`
      }
    }
    return null
  } catch {
    return null
  }
}
