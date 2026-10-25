# Greeting and draft brand — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

The later [CrumbCraft cookie revision](cookie-art-and-greeting.md) replaces this draft name and croissant with twelve cookie illustrations and adds the owner's introduction. This report retains the earlier entry-transition review.

Review URL: **http://192.168.1.33:4331/**. Refresh to load the new built assets. No changes have been committed or pushed to GitHub.

The proposed name is **Crumb & Craft**, with a transparent, responsive SVG logo showing a laminated croissant, copper spark and warm serif wordmark. It appears above the conditional greeting. The welcome screen contains only that logo, the welcome message, **Start Baking!**, and **An app made for curious bakers by Pixel & Principle** at the bottom center. A new unnamed guest sees **Welcome!**; saved-name and signed-in greetings retain their existing behavior.

Starting fades the entire greeting screen over 900 ms. The already-mounted Recipe List then sharpens from a 14-pixel blur over 1,050 ms. Its controls remain inert and hidden from assistive technology until the reveal finishes, then keyboard focus moves to the active page. Repeated starts are disabled during the sequence. Reduced-motion preferences skip directly to Recipe List. Timers and animation-frame focus work are cleaned up on component lifecycle changes.

The Recipe List and Profile page headings no longer have the former Pastry Chef eyebrow labels. The First Name form no longer has its welcome-back helper sentence.

TypeScript and the production build passed. **144 automated tests passed, zero failed**, and all **18 LAN smoke checks** passed against the updated assets. Browser verification for this revision uses isolated Chromium with third-party services blocked; no real Firebase account or OpenAI writes are needed.

Final browser checks passed at **375×812, 1280×800 and 844×390**, with no runtime errors. They verified the minimal greeting content and logo order, bottom-centered credit, named refresh, intermediate fade opacity, blur-to-focus sequence, inert controls until completion, final page focus, requested text removals, and the drawer's independent scrolling and retained recipe position. Reduced motion skipped the staged reveal. Additional 60-character-name checks passed at **375×812, 320×568 and 844×390** without overlap or viewport overflow. A stale font rule had enlarged landscape greetings; removing it restored the compact heading, and the welcome grid now allows intrinsic content height as a fallback.

All 16 final screenshots were inspected. Evidence is retained in ignored `artifacts/greeting-browser-results.json`, `greeting-long-name-results.json`, `greeting-{brand,named,fade,focus}-WIDTHxHEIGHT.png`, `greeting-long-name-WIDTHxHEIGHT.png` and `greeting-reduced-motion-recipes.png`. These are Chromium viewport checks; physical devices, Safari and live account synchronization were not exercised.
