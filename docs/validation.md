# Validation record

## Release baseline — October 25, 2026

The app owner confirmed that cloud sync is functioning as intended on **October 25, 2026**. This is user verification of the live profile behavior; the automated browser account flows below used isolated Firebase response fixtures.

| Check | Result | Scope |
| --- | --- | --- |
| Automated tests | **223 passed, 0 failed** | Recipe coverage/scaling, local saves and renaming, filters, navigation, notification lifecycle, Chef validation/authentication, bake history/aggregation and the Netlify adapter |
| History/storage adapter tests | **22 passed**, included above | Legacy migration, account isolation, guest claims, repeat IDs, deletion markers, favorite conflict handling, Firestore fallback and listener failure/retry |
| Netlify adapter/quota tests | **15 passed**, included above | Authenticated route behavior, request/origin controls, bounded processing, durable quota claims and cleanup behavior |
| Official Netlify function packaging | Passed | Three API v2 Node.js 24 bundles; expected route/limit/schedule metadata; no local environment files, logs or private QA artifacts |
| Extracted packaged handlers | Passed | Guest Chef request **401**, safe status **200**, no provider calls |
| TypeScript and production build | Passed | Final security-patched dependencies, browser bundle and generated server catalog/configuration |
| Dependency audit | **0 vulnerabilities reported** | Fresh network-backed `npm audit` after compatible build-tool updates and the scoped same-major Firestore Node gRPC override |
| LAN smoke checks | **20 passed** at the network-review baseline | Built assets, status, guest/forged-token rejection, cross-origin rejection, private-file routes and checked asset secret patterns |
| Isolated Chromium review | Passed | 375×812, 320×568, 1280×800 and 844×390; reduced motion at 375×812 |
| Browser behavior | Passed | Welcome entrance/exit, four-page navigation, favorites and combined filters, repeat logs, charts/table totals, history removal, account isolation, saved-copy reload and drawer scrolling |
| Cloud synchronization | Confirmed by app owner | User confirmation supplements fixture-based automated checks |
| Whitespace | Passed | `git diff --check`; Windows LF/CRLF notices are informational |

The Analytics/favorites browser review reported no page runtime errors and no AI submissions. Nineteen screenshots were inspected; a focused landscape-navigation check confirmed all four icons and labels. Private QA reports, screenshots, fixture sessions and provider examples remain outside version control.

The final build uses Vite **7.3.7**, source-map-js **1.2.2** and the scoped Node gRPC dependency **1.14.6**, while Firebase remains **12.19.0**. The browser asset hashes were unchanged by the final hosting/security maintenance, so the existing rendered UI checks apply. The original network-review baseline was 208 tests; the 15 hosted-adapter tests bring the release total to 223.

Deployment-specific validation and publication status belong in [release notes](release-notes.md). Successful tests/builds do not by themselves establish that the Netlify project has published the updated build.

The existing Netlify project, production URL and GitHub **main** connection were verified during release preparation. At that verification point it still served the earlier release, so no updated-publication claim follows from the connection check alone.

## What the checks establish

All **68 original recipe IDs** are retained. The recipe review covers **694 ingredient lines**, **489 explained steps** and **73 unique source URLs**. Metadata and scaling checks verify equipment, storage, review references, stable IDs, numeric amounts and 2.5× ingredient arithmetic. Calendar fixtures exercise Los Angeles spring and fall daylight-saving transitions with 23- and 25-hour days.

The software review covers content identity and in-place renaming, duplicate/import capacity handling, preserved completion/checklists after reload, household-unit display, scaled-batch behavior, schema validation and backend access boundaries. Firestore adapter tests use an in-memory store to test transactions, per-ID fallback merges, stale updates, deletion preservation and source readiness.

The initial LAN backend review made actual OpenAI requests for a coconut-oil adaptation, a dairy-allergy clarification and a completed dairy-free proposal after product-label details were supplied. Those responses validated integration and structured-output handling; they did not validate a finished bake or the suitability of a commercial ingredient for a particular person.

## Limits

- **No physical bakes were performed as part of this software/editorial review.** Revised library formulas and AI adaptations are not marked kitchen tested.
- Chromium viewport checks do not establish Safari behavior or every physical-device/browser combination.
- Automated account/browser checks used fixtures rather than creating live user accounts. Cloud sync was separately confirmed by the app owner.
- The automated negative Chef-access checks exercised the actual LAN server. A passing local check does not by itself establish the production host's secrets, authorization, limits or routing.
- The browser bundle includes Firebase and the recipe catalog. Its current build-size warning is a performance consideration for slower connections.
- The optional published Firestore subcollection rules and the compatible profile-document fallback have different storage capacity. The fallback is subject to Firestore's document-size limit; local data is retained when synchronization fails.

For practical bake feedback, record the recipe/version, ingredient labels and amounts, pan size/material, oven setting, and the step or doneness cue where the result diverged.

## Dated review history

The linked reports preserve their original review-stage facts. Earlier test counts, local URLs, unpublished status and testing limits are historical, not current release claims.

| Stage | Report |
| --- | --- |
| Recipe editorial review — October 24 | [Overview](recipe-review.md), [advanced](review-advanced.md), [middle](review-middle.md), [basics](review-basics.md) |
| Measurements and interface | [Measurements](measurements.md), [interface](interface-review.md), [drawer/US text](drawer-and-us-text.md) |
| Pages, drawer, profile and greeting | [Pages](pages-and-drawer.md), [profile/drawer](profile-and-drawer-controls.md), [greeting](greeting-and-brand.md) |
| Branding and recipe artwork | [Cookies](cookie-art-and-greeting.md), [gallery](recipe-gallery-and-cookie.md), [thumbnails/order](thumbnails-and-order.md) |
| Accounts, notifications and Chef prompts | [Account gate](accounts-notifications-and-cookie.md), [Chef shortcut/prompts](chef-shortcut-and-prompts.md) |
| Unique saves — 184 tests / 20 LAN checks | [Unique saves and notification motion](unique-saves-and-notification-motion.md) |
| Favorites/history/Analytics — 208 tests / 20 LAN checks | [Favorites, bake history and Analytics](favorites-history-and-analytics.md) |

The initial network-review base was commit `7882b8ed6602cd3bd850c0bff9da1a37d845079a` (`Show completed recipes in library`). The original initial review passed 92 tests and 18 LAN checks; subsequent reports record the progression to the release baseline above.
