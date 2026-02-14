# Task 1: App Branding

## Objective
Change the app's blue color scheme and branding to a new identity.

## Files to Modify

### Primary — Design System (ALF)
- **`src/alf/tokens.ts`** (lines 11-64) — All gradient definitions: primary, sky, midnight, nordic. This is the single most impactful file.
- **`src/alf/themes.ts`** — Theme palette wiring. References `primary_500` from `@bsky.app/alf` package.
- **`src/alf/util/colorGeneration.ts`** (line 3) — `BLUE_HUE = 211` constant used for programmatic color generation.

### Secondary — Legacy Colors
- **`src/lib/styles.ts`** (lines 28-72) — Deprecated but still referenced blue scale (`blue0`–`blue7`), `brandBlue: '#0066FF'`, and legacy gradient definitions (`blueLight`, `blue`, `blueDark`).

### Gradient Components
- **`src/components/GradientFill.tsx`** — Generic gradient renderer; consumes tokens from `tokens.ts`.
- **`src/components/LinearGradientBackground.tsx`** — Defaults to the "sky" gradient.
- **`src/features/nuxs/components/Gradient.tsx`** — NUX onboarding gradient using `primary_500` at low opacity.

### Hardcoded Blues
- **`src/style.css`** (lines 78, 82) — ProseMirror link & mention color: `#0085ff`.
- **`src/view/icons/Logo.tsx`** (lines 62-64) — SVG logo gradient stops: `#0A7AFF` → `#59B9FF`.

### Embed / OG Card
- **`bskyembed/tailwind.config.cjs`** (lines 8-9) — `brand: 'rgb(10,122,255)'`, `brandLighten: 'rgb(32,139,254)'`.
- **`bskyogcard/src/components/StarterPack.tsx`** (lines 12-14) — Gradient colors `#0A7AFF`, `#59B9FF`, stroke `#359CFF`.

### External Dependency
- **`@bsky.app/alf`** package — Supplies `primary_500` palette token used in `themes.ts`. To fully rebrand, this dependency's palette would need to be overridden or forked.

## Notes
- Start with `src/alf/tokens.ts` and `src/lib/styles.ts` for the broadest visual impact.
- The logo SVG in `Logo.tsx` uses inline gradient stops that need manual updating.
- The embed and OG card subsystems have their own independent color definitions.
