# Drawer and measurement correction — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

Review: **http://192.168.1.33:4331/#recipes**. Refresh an existing tab to load the new build. No GitHub push was performed.

Isolated Chromium testing reproduced three drawer defects in the previous build:

1. Opening focus could pan the full-screen dialog horizontally by the sheet width.
2. The grid list compressed ingredient rows while their long note content overflowed into neighboring cards.
3. A drag starting inside the list and ending over the backdrop could close the drawer as if the user had clicked outside.

The drawer now uses a viewport-bounded panel with natural-height list items and a dedicated scroll region. The dialog itself does not scroll. A single guarded controller owns open/close work and cancels stale callbacks, while backdrop dismissal requires a pointer action that starts and ends outside the sheet. The main recipe retains its position, and ingredient checkbox updates do not restart the drawer. Reopening the same recipe retains the ingredient-list position; opening another recipe or version starts its list at the top.

All recipe display fields now use standard US kitchen measurements: ingredient amounts and notes, equipment, method titles/details/why/tips, storage, yield, saved names, adaptation history, references and AI summaries/questions/considerations. Existing saved and older AI responses go through the same display conversion. Units in source URLs and record identifiers remain untouched. The UI does not show conversion caveat notices.

The AI chef receives a recipe written in standard units and its generated ingredient schema accepts only counts, tsp, tbsp, cups, oz, lb and fl oz. Generated guidance is normalized before display. The calculation source is kept separate from the display clone so repeated batch scaling and saved progress retain their existing behavior.

Automated verification: **135 tests passed, zero failed**, including drawer lifecycle/gesture/scroll regressions and the complete 68-recipe display scan at original, half and 2.5× batch sizes. TypeScript and production builds passed. A real OpenAI substitution request returned a complete standard-unit recipe; mocked provider responses exercise legacy text conversion without additional service calls.

Final isolated Chromium regression checks passed at **375×812, 1280×800 and 844×390**. The drawer list reached scroll position 700 while the recipe page stayed at 900. Row containment, zero horizontal dialog scroll, checkbox updates, list-to-backdrop drags, six rapid reopen cycles, Escape, browser Back, same-recipe scroll retention and new-recipe reset passed. Mocked legacy AI guidance and generated input values were also checked for standard measurements. No runtime errors were recorded.

All four final screenshots were inspected. Evidence is retained in ignored `artifacts/drawer-final-browser-results.json`, `drawer-fixed-375x812.png`, `drawer-fixed-1280x800.png`, `drawer-fixed-844x390.png` and `mock-ai-standard-measures.png`. The current server passed all **18 LAN smoke checks**. These are isolated Chromium viewport tests, not physical-device, Safari or kitchen validation.
