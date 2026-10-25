# Profile greeting and drawer controls — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

Review URL: **http://192.168.1.33:4331/**. Refresh an existing tab to load the updated build. Nothing has been committed or pushed to GitHub.

Recipe List now places **Category** before **Skill level**, matching the recipe card labels. Selecting a skill still limits the available categories and clears a category that is no longer available.

Profile includes **First Name** and **Save first name**. A saved name produces **Welcome back, [name]!** on refresh; a signed-in baker with no name sees **Welcome back!** A first-time unnamed guest retains the original introduction. The greeting appears after a refresh from any app page and includes **Start Baking!**, opening Recipe List.

Names are normalized for spacing and stored separately for guests and each account. Signed-in saves also update the Firebase Auth display name when available, with local retention and a status message if profile sync fails. Clearing a name records the intentional empty value so a stale cloud display name cannot immediately restore it. Storage failures report an error rather than a successful save.

The fixed Current Recipe header now offers **Ingredient List / Save**. The drawer pins the batch multiplier above its independently scrolling checklist and the save controls below it. Batch guidance stays in a collapsible section inside the scrolling region. Named saved copies retain their scaled amounts, and saving leaves the drawer open with feedback inside it. Background scroll anchoring is disabled while the drawer is open so changes to recipe text or save feedback preserve the reading position.

Verification: **144 automated tests passed, zero failed**; TypeScript and the production build passed. All **18 LAN checks** passed against the current built assets. The added tests cover personal and generic greetings, first-name persistence, guest/account isolation, intentional clearing, corrupt records, blocked storage and scroll-lock restoration. No new OpenAI requests or live Firebase account writes were used for this revision.

Isolated Chromium checks passed at **375×812, 1280×800 and 844×390**, with no runtime errors. They verified Category-first ordering and skill filtering, Unicode name persistence and clearing, greeting refresh from both Profile and Current Recipe, drawer-only controls, multiplier focus, independent ingredient scrolling, fixed batch/save positions, and reopening a named 2.5× saved copy. The recipe stayed at scroll position 900 throughout opening, scaling, checkbox changes, list scrolling and saving, while the ingredient list reached 700. Standard-unit display and absence of conversion caveats also passed. The initial desktop script had raced the recipe-selection animation; the final run waited for that transition before measuring scroll.

Final screenshots were inspected for all three drawer sizes and the welcome screen. Evidence is retained in ignored `artifacts/profile-drawer-browser-results.json`, `profile-save-drawer-375x812.png`, `profile-save-drawer-1280x800.png`, `profile-save-drawer-844x390.png` and `welcome-375x812.png` (with additional welcome captures at the other two sizes).

Live Firebase profile synchronization, physical-device behavior and Safari were not exercised. Browser runs blocked third-party services. The existing recipe and AI review limits still apply; see [validation.md](validation.md).
