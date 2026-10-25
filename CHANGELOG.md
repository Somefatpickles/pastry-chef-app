# Changelog

## October 25, 2026 — CrumbCraft

### Added

- CrumbCraft branding with twelve distinct generated cookie illustrations, random greeting selection, interactive cookie transitions and a staged welcome.
- Individually generated artwork for all 68 library recipes, with thumbnails on Recipe List and full illustrations on Current Recipe.
- Four pages with bottom navigation: Recipe List, Current Recipe, Profile and sign-in-only Analytics.
- Status and Favorites filters, with favorite stars on Recipe List and Current Recipe.
- Separate dated completion records for repeat bakes, persistent history, per-profile activity and chart controls for totals, difficulty, category and distinct recipes.
- A right-side ingredient drawer with an independent scrolling checklist, batch multiplier, local-save controls and in-place recipe renaming.
- Inline email/password enrollment for AI Pastry Chef, authenticated backend requests, variable example prompts, temporary proposals and blue change highlights.
- First-name greetings, local collection backups, account-specific history/favorites and cloud-sync retry feedback.
- A Netlify Functions Chef backend with validated Firebase sessions, trusted origins, durable request quotas and bounded request processing.

### Improved

- Reviewed all 68 recipes for ingredient balance, complete components, temperatures, timing, pan/equipment guidance, doneness, explanations, cooling and storage.
- Standardized household baking-measure display throughout recipes, guidance and AI results.
- Prevented duplicate local saves/imports while preserving saved IDs and progress when only a name changes.
- Kept random recipe order stable during a visit and refreshed it on reload.
- Smoothed page, welcome, cookie and notification transitions, including reduced-motion behavior.
- Preserved local writes during cloud failures and prevented stale snapshots or delayed writes from restoring removed history/favorites.
- Updated compatible build dependencies and scoped Firestore's Node-only gRPC dependency override for the patched same-major range.

### Validation

Release verification passed **223 automated tests**, including 15 Netlify adapter/quota tests, and the TypeScript/production build. A fresh network-backed dependency audit reported **0 vulnerabilities**. The published Netlify application passed **32 production HTTP checks**, including hosted Chef availability and negative access boundaries, without a paid provider request. The network-review baseline also passed 20 LAN checks, four Chromium viewport sizes and reduced motion. The app owner confirmed cloud sync. See [validation](docs/validation.md) and [release notes](docs/release-notes.md) for scope and deployment verification.

The recipes and AI variants have not been kitchen tested as part of this release.
