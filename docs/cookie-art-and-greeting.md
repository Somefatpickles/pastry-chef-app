# CrumbCraft cookie artwork and greeting — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

The later [recipe gallery and cookie interaction](recipe-gallery-and-cookie.md) adds the interactive cookie, moves Recipe List/Profile branding beside their headings, removes Current Recipe branding and introduces all 68 recipe photos. This report retains the earlier cookie-art and compact-brand review.

Review URL: **http://192.168.1.33:4331/**. Refresh to load the updated greeting. No changes have been committed or pushed to GitHub.

The brand is now **CrumbCraft**. Twelve independently generated cookie illustrations replace the croissant. One is selected uniformly at random when the greeting mounts on a fresh page load; it remains unchanged through name updates, hash navigation and the fade. Repeated loads can select the same cookie. Only the selected image is requested for the greeting.

The user's supporting paragraph appears immediately below the conditional welcome, verbatim:

> With CrumbCraft, you can learn and practice standard pastry chef recipes, progress through to more complex offerings, and even use an AI Pastry Chef to tailor recipes to your own needs, with useful tips along the way.

The wordmark and browser title use CrumbCraft, and the favicon uses the chocolate chip cookie. The existing 900 ms greeting fade, 1,050 ms blur-to-focus reveal, reduced-motion bypass, saved-name behavior and bottom-centered Pixel & Principle credit remain. Short screens can scroll the welcome page without content overlap.

## Separate assets

Each illustration was generated in its own built-in image-generation call using a common warm editorial bakery style, a slightly top-down view, a complete centered cookie and a transparent background. Each original is a distinct 1,254 × 1,254 RGBA PNG. Web versions preserve transparency at 512 × 512, totaling 1,173,998 bytes across all twelve. The selected image is 53–130 kB. Re-encoding and resizing were technical asset preparation; the cookie artwork was not redrawn during conversion.

| Cookie | Web asset |
| --- | --- |
| Chocolate chip | [chocolate-chip.webp](../public/cookies/chocolate-chip.webp) |
| Snickerdoodle | [snickerdoodle.webp](../public/cookies/snickerdoodle.webp) |
| White chocolate macadamia nut | [white-chocolate-macadamia.webp](../public/cookies/white-chocolate-macadamia.webp) |
| Frosted sugar | [sugar-cookie.webp](../public/cookies/sugar-cookie.webp) |
| Oatmeal raisin | [oatmeal-raisin.webp](../public/cookies/oatmeal-raisin.webp) |
| Peanut butter | [peanut-butter.webp](../public/cookies/peanut-butter.webp) |
| Double chocolate | [double-chocolate.webp](../public/cookies/double-chocolate.webp) |
| Ginger molasses | [ginger-molasses.webp](../public/cookies/ginger-molasses.webp) |
| Lemon crinkle | [lemon-crinkle.webp](../public/cookies/lemon-crinkle.webp) |
| Red velvet | [red-velvet.webp](../public/cookies/red-velvet.webp) |
| Raspberry thumbprint | [raspberry-thumbprint.webp](../public/cookies/raspberry-thumbprint.webp) |
| Shortbread | [shortbread.webp](../public/cookies/shortbread.webp) |

The full-size originals are retained locally under ignored `artifacts/cookie-originals/`. File hashes, dimensions, transparency and byte counts are recorded in `artifacts/cookie-assets.json`; `artifacts/cookie-contact-sheet.png` shows all twelve. The contact sheet and all original generated images were visually inspected for distinct identity, complete framing and background consistency.

## Verification

TypeScript and the production build passed. **144 automated tests passed, zero failed**, and all **18 LAN checks** passed against the current assets. The preview server now serves WebP with its image media type; all twelve files decode correctly and have distinct hashes and transparent alpha.

Isolated Chromium checks passed at **375×812, 1280×800, 320×568 and 844×390** with no JavaScript runtime errors. Tests forced each of the twelve random-selection buckets to verify its expected source, label and decoded image. Cookie selection stayed stable across parent rerenders; eight ordinary reloads displayed six variants. Tests also verified the exact paragraph below the welcome, brand order, named and 60-character greetings, fade and focus sequence, inertness until entry completes, reduced-motion bypass, and independently scrolling ingredient drawer with the recipe's reading position retained. The 320×568 welcome scrolls vertically so the full introduction, button and footer remain reachable without overlap.

Evidence is retained in ignored `artifacts/crumbcraft-browser-results.json` and `crumbcraft-{welcome,named,long-name}-WIDTHxHEIGHT.png`, with additional scrolled and reduced-motion captures. Testing used isolated Chromium with third-party services blocked; physical devices, Safari and live profile synchronization were not exercised.

All **17 final screenshots** were visually inspected after awaiting image decoding and two paint frames; every on-screen logo region displayed its cookie. This corrected premature screenshot capture in the first browser pass and required no application changes. Short-screen and long-name overflow stays inside the welcome page, with the button and footer reachable and no horizontal overflow or overlap.

## Compact branding on the three app pages

Recipe List, Current Recipe and Profile now include the cookie and CrumbCraft wordmark in a compact, right-aligned row above their page content. The compact mark is 166 pixels wide, with a 36-pixel cookie and 124-pixel wordmark. Its reserved row keeps it clear of headings and controls. On Current Recipe it sits below the fixed title and Ingredient List / Save bar.

Cookie selection is owned once by the app for the page load and shared with the greeting and all three page marks. Navigation and profile edits retain that selection. The greeting's artwork, wordmark sizing, text and fade remain as previously reviewed.

The production build, **144 automated tests** and **18 LAN checks** passed. Targeted Chromium checks passed at **375×812, 320×568, 1280×800 and 844×390**, with all **20 screenshots** visually inspected. Each page has one compact mark aligned to the content's right edge, clear of its heading and controls, using the greeting's cookie. Empty and selected Current Recipe states passed; the fixed ingredient control stayed clear and the drawer retained recipe scroll position 900 through scaling, checkbox updates, list scrolling and closing. Greeting appearance, text, entry focus and name updates passed with no runtime errors. Evidence: ignored `artifacts/compact-brand-browser-results.json` and `compact-brand-{greeting,recipes,current-empty,current-selected,profile}-WIDTHxHEIGHT.png`. These were isolated Chromium checks without live sign-in or provider requests.
