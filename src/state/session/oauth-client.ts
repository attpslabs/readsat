type OAuthInitResult = {
  session: unknown
  state?: string | null
}

export async function initOAuthClient(): Promise<OAuthInitResult | null> {
  return null
}

export async function startOAuthSignIn(_handle?: string): Promise<never> {
  throw new Error('OAuth not supported on native')
}

export function getOAuthClient(): {
  restore: (did: string) => Promise<unknown>
} | null {
  return null
}
