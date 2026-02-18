import {
  BrowserOAuthClient,
  buildLoopbackClientId,
} from '@atproto/oauth-client-browser'

let oauthClient: BrowserOAuthClient | null = null

export async function initOAuthClient() {
  const clientId = __DEV__
    ? buildLoopbackClientId(window.location)
    : 'https://reads.at/oauth/client-metadata.json'

  oauthClient = await BrowserOAuthClient.load({
    clientId,
    handleResolver: 'https://bsky.social/',
  })
  return (await oauthClient.init()) ?? null
}

export async function startOAuthSignIn(handle?: string): Promise<never> {
  if (!oauthClient) throw new Error('OAuth client not initialized')
  return oauthClient.signInRedirect(handle || 'bsky.social')
}

export function getOAuthClient() {
  return oauthClient
}
