# Task 2: Update PDS to self.surf

## Objective
Change the default PDS from Bluesky Social (`bsky.social`) to `self.surf` so that account creation and signup work natively against the self.surf PDS.

## Reference: Linkname Signup Flow

The Linkname app (a separate project) already implements self.surf account creation. Use it as a pattern reference.

### Key Architecture
- **Signup page**: `src/app/signup/page.tsx` — client component with handle, email, password fields, real-time handle availability checking, and a "Continue with Bluesky" OAuth option.
- **Default PDS**: `https://self.surf`
- **Handle format**: `{username}.self.surf`

### API Routes (Linkname)
| Route | Purpose |
|---|---|
| `POST /api/auth/create-account` | Creates account on self.surf |
| `GET /api/auth/check-handle` | Checks handle availability |
| `POST /api/auth/login` | Creates a session |
| `POST /api/auth/refresh` | Refreshes JWT tokens |

### Account Creation Flow (Two-Step)
1. **Create account** via `POST /xrpc/com.atproto.server.createAccount` on `https://self.surf`, authenticated with a `SECRET_LINKNAME` env var passed as an `X-App-Secret` header.
2. **Create basic profile** via `POST /xrpc/com.atproto.repo.putRecord` using the new account's access JWT.

### Validation Rules
- **Handle**: 3-20 chars, alphanumeric + hyphens, no leading/trailing hyphens
- **Password**: minimum 8 characters
- **Email**: format validation

### Handle Utilities (Linkname)
In `src/lib/utils.ts`:
- `DEFAULT_PDS_SUFFIX = '.self.surf'`
- `displayHandle()` — strips the suffix for display
- `expandHandle()` — appends the suffix
- `isDefaultPdsHandle()` — checks if a handle belongs to self.surf

### Auth Library (Linkname)
`src/lib/atproto.ts` — client-side auth functions (`signIn`, `signOut`, `refreshSession`, `signInWithOAuth`). Sessions stored in localStorage under `linkname_session`.

### Multi-PDS Support (Linkname)
- Login is PDS-aware: `self.surf` handles go directly to `https://self.surf`, other domains resolve via `.well-known/atproto-did` or Bluesky API.
- `agent.ts` has `getProfileFromPds()` for fetching profiles directly from a user's PDS (handles non-federated PDSes like self.surf).

## Files to Investigate / Modify in readsat

> TODO: Investigate and fill in once work begins.

- Default PDS / service URL configuration
- Account creation / signup screens and logic
- Handle suffix defaults (`.bsky.social` → `.self.surf`)
- Session / auth agent setup
- Handle validation and formatting utilities
- Any hardcoded references to `bsky.social` or `bsky.network`
- Environment variable configuration for PDS secret/auth

## Notes
- The self.surf PDS requires an `X-App-Secret` header for account creation — this will need an env var (`SECRET_LINKNAME` or equivalent) and likely a server-side proxy or API route to avoid exposing the secret in the client.
- Multi-PDS login support from Linkname is a good pattern to follow for allowing both self.surf and external PDS users.
