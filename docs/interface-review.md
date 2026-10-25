# Interface refinement — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

The subsequent [page and drawer revision](pages-and-drawer.md) moves sign-in to Profile and separates recipe selection from the current bake. The table below records the preceding layout.

Network preview: **http://192.168.1.33:4331**. These changes remain local for review; no GitHub push was performed.

| Request | Result |
| --- | --- |
| Filter categories by skill | Category options come only from recipes at the selected level, including saved collections. Unavailable selections reset automatically after skill/collection changes or deletion. Challenge recipes with no category remain visible with Category disabled. |
| Replace top metrics with login | Library-progress sign-in, account creation, status, errors and sign-out now occupy the header's former metrics area. |
| Move AI below recipe references | The chef is last in the selected-recipe workspace, after storage and the canonical recipe's review/reference panel. |
| Highlight applied AI edits blue | Changed title, description, timing, yield, equipment, notes, ingredient rows, steps and storage appear blue. Removed ingredients/steps are listed in a blue removal note. Updated rows include a text label as well as color. Comparison snapshots survive saving, reload, further AI changes and subsequent scaling. |
| Compact fixed recipe context | A viewport bar retains title, difficulty and current batch: 54 px on desktop, 62 px on mobile, plus device safe-area inset. Long text truncates visually while the complete value remains accessible. Scroll offsets prevent the bar covering the recipe target. |
| Household measurements | All 694 ingredient lines in 68 recipes use familiar primary units. Ingredient-specific density references support cups/spoons; package ounces avoid invented cup conversions for chocolate, pastry and variable mixtures. Original, half and 2.5× batches were checked: 2,082 displays. Exact underlying formulas remain unchanged. See [measurement sources and limits](measurements.md). |
| Remove adapted reference block and revise footer | Adapted recipes no longer show “Original library review & references.” Canonical recipes retain “Recipe review & references” as the chef's placement anchor. The footer is exactly “An app made for curious bakers by Pixel & Principle.” The researched-date and large-batch footer text is removed. |

Validation: **115 automated tests passed, zero failed**. This includes new filter, semantic-diff, persisted comparison-snapshot and household-measurement regressions, plus the prior recipe, scaling, local-storage and backend checks. TypeScript and the production build passed. The LAN page, built assets and existing API were checked without additional paid provider requests.

Rendered browser/physical-device testing remains unverified: supported browser-control skills are unavailable in this session, and the prior Computer Use discovery attempts had already exhausted their bounded retries. The tests and HTTP checks do not establish actual touch layout or rendering. The network preview is available for that review. Recipe formulas and volume equivalents have not been physically kitchen tested.
