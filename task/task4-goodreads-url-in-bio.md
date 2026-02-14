# Task 4: Goodreads URL in Bio

## Objective
Add a "Goodreads Profile" input field to the Edit Profile dialog. When saved, store the URL as a custom lexicon record (`at.reads.goodreads`) on the user's PDS. Display it as a clickable button on the profile header that opens the Goodreads URL externally.

## Files to Modify

### 1. Edit Profile Dialog — Add Input Field
**File**: `src/screens/Profile/Header/EditProfileDialog.tsx`

- **Component**: `DialogInner` (lines 89-393)
- **Current fields**: avatar, banner, displayName (max 64 graphemes), description (max 256 graphemes)
- **Form state**: managed via `useState` hooks (lines 114-128)
- **What to do**:
  - Add `goodreadsUrl` state variable
  - Add a new `<TextField>` below the Description input (after line ~388)
  - Label: "Goodreads Profile"
  - Placeholder: `https://goodreads.com/user/show/...`
  - Validate that the URL starts with `https://goodreads.com/` or `https://www.goodreads.com/`
  - On save, call `putRecord` to write the `at.reads.goodreads` record to the user's PDS

### 2. Profile Save Logic — Write Custom Lexicon Record
**File**: `src/state/queries/profile.ts`

- **Mutation**: `useProfileUpdateMutation()` (lines 142-243)
- **Current behavior**: calls `agent.upsertProfile()` which uses `com.atproto.repo.putRecord` on `app.bsky.actor.profile` collection
- **What to do**:
  - After the profile upsert, add a second `com.atproto.repo.putRecord` call:
    ```
    collection: 'at.reads.goodreads'
    rkey: 'self'
    record: { $type: 'at.reads.goodreads', url: goodreadsUrl }
    ```
  - If the user clears the field, delete the record via `com.atproto.repo.deleteRecord`
  - Reference pattern: `GermButton.tsx` (lines 125-154) uses `agent.com.germnetwork.declaration.put()` / `.delete()` — we'll use the raw `putRecord` API instead since we don't have typed SDK methods

### 3. Profile Query — Fetch the Record
**File**: `src/state/queries/profile.ts`

- **What to do**:
  - Create a new query hook `useGoodreadsQuery(did)` that calls `com.atproto.repo.getRecord`:
    ```
    repo: did
    collection: 'at.reads.goodreads'
    rkey: 'self'
    ```
  - Returns the URL string or null if no record exists
  - Used by both the Edit Profile dialog (to populate the field) and the profile header (to show the button)

### 4. Profile Header — Display Goodreads Button
**File**: `src/screens/Profile/Header/ProfileHeaderStandard.tsx`

- **Component**: `ProfileHeaderStandard` (lines 57-209)
- **Placement**: After the Germ button section (line 167-169), before Known Followers (line 173)
- **What to do**:
  - Create a `GoodreadsButton` component (new file or inline)
  - Fetch the `at.reads.goodreads` record using `useGoodreadsQuery(profile.did)`
  - If a URL exists, render a button styled similarly to the Germ button
  - On press, open the URL externally using the `useOpenLink()` hook from `src/lib/hooks/useOpenLink.ts`
  - The hook uses `expo-web-browser` on native (in-app browser) with fallback to `Linking.openURL()`

### 5. New Component — GoodreadsButton
**File**: `src/screens/Profile/components/GoodreadsButton.tsx` (new file)

- Follow the pattern from `GermButton.tsx` (lines 28-99)
- Props: `did: string`
- Fetches the goodreads record
- Renders a button with Goodreads branding/icon
- Uses `<Link>` component or `useOpenLink()` for external navigation
- Opens in new tab on web, in-app browser on native

## Lexicon Record Schema

```json
{
  "lexicon": 1,
  "id": "at.reads.goodreads",
  "defs": {
    "main": {
      "type": "record",
      "key": "self",
      "description": "A record containing the user's Goodreads profile URL.",
      "record": {
        "type": "object",
        "required": ["url"],
        "properties": {
          "url": {
            "type": "string",
            "format": "uri",
            "description": "The user's Goodreads profile URL."
          }
        }
      }
    }
  }
}
```

## External Link Handling Reference

From `src/lib/hooks/useOpenLink.ts`:
- Native: uses `expo-web-browser` for in-app browser, falls back to `Linking.openURL()`
- Web: uses `Linking.openURL()` which opens in default browser
- Consent dialog shown on first external link click (in-app browser preference)

## Notes
- The `GermButton` in `ProfileHeaderStandard.tsx` (line 167) is the closest existing pattern for what we're building — an external service link displayed on the profile.
- Validation should reject non-Goodreads URLs to prevent misuse.
- Consider caching/invalidation: after saving, invalidate the goodreads query so the profile header updates immediately.
- The `at.reads.goodreads` namespace should be registered if the PDS enforces lexicon validation, but most PDSes (including self.surf) allow arbitrary record types.
