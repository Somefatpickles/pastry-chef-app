# Chef shortcut and rotating prompt choices — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

Review URL: **http://192.168.1.33:4331/**. Refresh the app to load this revision. No changes have been committed or pushed to GitHub.

Standard recipe review summaries now read **Recipe review & references**, without their review timestamp. Review dates remain in the underlying recipe metadata for provenance.

The fixed Current Recipe bar includes a 44-pixel blue square with two diagonal sparkle stars, directly left of **Ingredient List / Save**. The ingredient button uses two lines, with **/ Save** below **Ingredient List**. The shortcut is labeled **Go to AI Pastry Chef** for assistive technology. It focuses the Chef section without scrolling on focus, then smoothly scrolls only the Current Recipe pane toward it. Reduced-motion preferences skip the animation. If a batch multiplier is invalid, the same target presents a blue batch-size repair section and a button to open the drawer; AI generation remains unavailable until the multiplier is valid.

Both the sign-in gate and authenticated Chef panel use a blue palette matching AI recipe adjustments, including status, prompts, buttons, form focus and proposal details. The former **A little help in the kitchen** eyebrow is removed.

The [twelve prompt suggestions](../shared/chef-prompts.mjs) cover batch scaling, half batches, missing ingredients, allergen details, equipment changes, sweetness, make-ahead planning, storage/freezing, texture, ingredient temperatures, serving sizes and workflow. Three distinct choices are randomly selected without replacement for each Chef session. One of those three becomes the textarea placeholder. The selection stays stable while typing, making requests and unlocking through authentication; opening another recipe or working version creates a fresh selection. Clicking a choice fills the request as before. The prompts use standard measures and ask for missing details when needed.

The existing account requirement, authenticated request boundary, floating action notifications, recipe images, per-load library ordering and cookie interactions are retained.

## Verification

**166 automated tests passed, zero failed**, including two new checks for twelve distinct prompts, unique trio selection, placeholder membership and pool immutability. TypeScript and the production build passed. Independent source and browser checks are recorded with the final review results.

All **20 live LAN checks** passed against the updated build, retaining authenticated Chef enforcement and private-file boundaries.

Final isolated Chromium checks passed at **375×812, 320×568, 1280×800 and 844×390**, with all **12 header/guest/authenticated screenshots** visually inspected. The review summary has no date and retains its source links. The 44-pixel sparkle control is left of the compact two-line ingredient button with no overlap or horizontal overflow. Native scroll samples confirmed intermediate smooth-scroll offsets in the Current Recipe pane without window movement, correct final focus, and immediate movement under reduced-motion preferences. The installed headless shell disables native smooth scrolling by default; the final run explicitly enabled it after an isolated plain-scroller diagnostic.

Guest and authenticated panels passed the blue-theme and removed-eyebrow checks. Rendered suggestions were three distinct members of the twelve-item pool; the placeholder matched one, typing/relogin retained the selection, clicking a choice filled the request, and new recipe/reload sessions produced variety. Invalid-batch repair, drawer/toast reading position 900, cookie landing and library-order stability also passed. No runtime errors, Chef POSTs, live sign-ups or provider requests occurred; authentication used isolated fixtures.

Evidence: ignored `artifacts/chef-shortcut-browser-results.json`, `chef-shortcut-browser-qa.cjs` and `chef-shortcut-{header,guest,auth}-WIDTHxHEIGHT.png`. Physical-device and Safari behavior were not exercised.
