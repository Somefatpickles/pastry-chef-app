# Pages and ingredient drawer — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

Review the updated app on the existing server: **http://192.168.1.33:4331/#recipes**. Refresh an already-open copy to load this build. No GitHub push was performed.

- **Recipe List:** library and local recipe collections, search, skill/category filtering, recipe selection and saved-recipe backup tools. Selecting a recipe opens Current Recipe. Selecting the already-current recipe preserves its working adaptation, batch multiplier and checklist.
- **Current Recipe:** the selected bake's header, batch and save controls, adaptation notes, equipment/preparation guidance, full method, completion logging, post-bake storage, references where applicable, and AI chef. “Log as completed” follows the last method step.
- **Profile:** library-progress login, account creation, sync status, sign-out and local-data context.

The bottom bar stays available on all three pages and reserves device safe-area space. Pages slide one viewport in the appropriate direction, including a direct Recipe List ↔ Profile change. Inactive pages remain mounted to retain scroll positions, draft AI requests and proposals; they are inert and hidden from accessibility while inactive. Reduced-motion preferences disable the slide. Hash routes support browser Back/Forward.

On Current Recipe, the fixed compact header shows the title, difficulty and batch alongside a top-right **Ingredient List** button. Its right-side drawer provides an independently scrollable checklist with the same household measures and blue AI change highlights. Ingredient checks use the same recipe progress record rather than a separate drawer copy. Closing the drawer restores the method's previous scroll position.

The drawer uses a native modal dialog in the document's top layer, with close/backdrop/Escape handling, keyboard focus containment and focus return. If route navigation removes the original trigger, focus returns to the active page instead. The background recipe page is scroll-locked only while the drawer is open.

Validation: **119 automated tests passed, zero failed**; TypeScript and production build passed. Existing tests cover recipe data, scaling, household measurements, storage, change tracking and backend behavior. Four route/offset regressions cover valid/invalid pages, navigation direction and one-viewport slide displacement. Code review checked page ownership, shared progress, mounted AI state, focus and scroll handling. Final LAN checks cover the actual page/assets and existing API without new paid AI requests.

Rendered browser/device interactions and animation appearance remain unverified because supported browser controls are unavailable in this session. This network build is provided for that review. Prior recipe and measurement kitchen-testing limits remain unchanged.
