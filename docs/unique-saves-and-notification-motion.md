# Unique local recipes and notification motion

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

The Ingredient List drawer now distinguishes saving a recipe, renaming an opened local recipe, and saving a distinct working version.

- A library recipe uses **Name your saved copy** and **Save to My recipes**.
- An opened local recipe uses **Recipe name** and **Save changes** while its recipe content is unchanged. Only its title is replaced, retaining the saved ID, ingredient and step IDs, comparison baseline, and baking progress.
- A changed local recipe uses **Name your new version** and **Save as new recipe**. Distinct ingredient quantities, method, equipment, storage or relevant guidance create a separate saved version.
- Repeating a save, or changing only the name of a library copy that was already saved, reports the existing recipe without adding a duplicate or renaming another entry.
- Imports skip duplicate content both within the backup and against the current collection. Capacity is checked after skipping duplicates; an over-capacity import leaves the collection unchanged. Renaming and unchanged saves still work at the 200-recipe limit.

Recipe identity ignores names, record/ingredient/step IDs, presentation labels, timestamps, references and adaptation bookkeeping. Equivalent numeric quantity forms and known unit aliases match; ingredient quantities retain their precision. Generated scaling guidance does not make an otherwise identical batch distinct. Meaningful adaptation considerations remain part of a recipe. Existing duplicate records are preserved to avoid deleting their names or progress.

Successful writes update a current collection reference before rendering, so a repeated save or an import finishing after another save sees the latest collection. Failed localStorage writes leave the current collection unchanged.

Notifications use a 320 ms opacity and blur transition into focus and a 300 ms transition out, retaining the card during its exit. Dismissal and automatic expiry share the same exit behavior. Hover and keyboard focus continue to pause expiry; duplicate messages can revive a card during its exit. Reduced motion removes blur and movement and dismisses immediately.

Verification: **184 automated tests passed**, including 13 focused saved-recipe cases and 12 notification lifecycle cases. TypeScript and the production build passed. **20 live LAN checks passed** against the updated built assets and the existing authentication/private-file boundaries.

Isolated Chromium checks passed at **375×812, 320×568, 1280×800 and 844×390**, plus reduced motion at 375×812. They exercised repeated/name-only duplicate attempts, in-place renaming, unchanged saves, reload-persistent IDs and completion/checklists, distinct 2.5× versions, returning a saved scaled batch to its original amount, and collisions with another saved version. Imports added one unique recipe while skipping two duplicates; importing the backup again added none. Renaming worked at 200 entries while an additional distinct save was refused. Legacy duplicate records were not removed.

The drawer kept a separately scrollable ingredient area and the recipe's reading position of 900 px. Keyboard dismissal returned focus to **Save changes**. Entry and retained-exit opacity/blur were sampled in the browser, and 19 screenshots were inspected for phone, desktop, landscape and reduced-motion layouts. A controlled browser clock confirmed independent hover/focus pauses, same-ID duplicate refresh and automatic visible → exiting → removed behavior with a 300 ms exit. All five layout/motion flows and five functional edge cases passed with no page runtime errors. The aggregate report is `artifacts/unique-save-browser-qa-final-report.json`; raw reports, harness and images are also retained under ignored `artifacts/`. These were isolated browser checks, with no physical-device testing, account creation or paid AI calls.

Review is on the existing LAN server at **http://192.168.1.33:4331/**. No GitHub commit or push is part of this update.
