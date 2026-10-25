# Recipe gallery and cookie interaction — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

The later [thumbnail and detail-image review](thumbnails-and-order.md) switches cards to thumbnails only, adds the full image to Current Recipe, introduces per-load random ordering and enlarges the compact wordmark. This report retains the original gallery and interaction verification.

Review URL: **http://192.168.1.33:4331/**. Refresh to load the new build. No changes have been committed or pushed to GitHub.

The cookie is now a native button on the greeting, Recipe List and Profile. Click, tap, Enter or Space launches a one-second bounce and full spin, followed by a small landing squash and return to the exact resting position. The image moves inside a stationary hit target, so surrounding content does not shift. Repeated activations during a flight do not restart it. Unmounting cancels its animation. Reduced-motion preferences replace the movement with a 180 ms scale response.

Recipe List and Profile now place the compact brand beside their page headings instead of using a separate branding row. At the smallest width the compact mark stacks internally to keep the heading and brand beside each other without overlap. Current Recipe has no brand mark; its fixed recipe title and ingredient controls retain their existing layout.

## Recipe artwork

All **68 original library recipes** have an individually generated image. Each image was created with the **built-in image-generation tool**, using its recipe's actual ingredients and method for the finished shape, fillings, layers and toppings. The shared prompt direction was premium natural editorial bakery photography, soft warm window light, neutral cream ceramics and linen, a centered finished bake/component with generous crop margin, and no people, text, branding or invented toppings. Full individual prompts, file paths, hashes and provenance are in [recipe-artwork-manifest.json](recipe-artwork-manifest.json).

The images are generated illustrations of the recipes, not photographs of kitchen-tested app results. The existing recipe review and practical-bake limitations still apply.

Final assets live in [public/recipe-images/](../public/recipe-images/), with one **640×400 WebP** and one **320×200 thumbnail** per recipe. Cards use responsive sources, lazy loading and reserved image proportions to keep loading and scrolling steady. Photos are part of the recipe selection button. Saved copies with a known library source inherit that recipe's image; imported custom recipes without a known source retain their text cards.

Full-size generator originals and refinement variants are retained under ignored `artifacts/recipe-image-originals/`. Agent manifests and original generator paths are retained under `artifacts/recipe-art-batch-{a,b,c}.json`. The authoring script `scripts/prepare-recipe-art.mjs` uses Sharp to prepare WebP sizes and overview sheets; Sharp is not needed by the running app. An authoring environment can install Sharp or set `CRUMBCRAFT_SHARP_MODULE` to its module path.

## Verification

Each generated original was visually inspected. The preparation script verifies coverage of all 68 IDs, distinct image hashes, both exact output dimensions and complete source/prompt records. Final overview sheets are retained under ignored `artifacts/recipe-art-sheet-{1,2,3,4}.png`.

All four final overview sheets were inspected, covering all 68 images. The final set has 68 distinct source hashes, 68 distinct full-size image hashes, 136 WebP files and 68 recorded generation prompts. Both image sizes together total **3,659,624 bytes**; the app requests responsive images as cards approach view. The existing **144 automated tests passed with zero failures**.

TypeScript and the production build passed. All **18 LAN smoke checks** passed on the current build. `node scripts/verify-recipe-art.mjs http://192.168.1.33:4331` verified **all 136 live image files**, their WebP media types, SHA-256 hashes and complete coverage of the 68 canonical recipes.

Final isolated Chromium checks passed at **375×812, 320×568, 1280×800 and 844×390**, with all **16 screenshots** visually inspected. All 68 unique recipe images decoded, and responsive source sets and lazy-loading attributes passed. The checks covered header alignment, no Current Recipe branding, photo selection, search and skill/category filters, saved-copy image inheritance, and the ingredient drawer retaining recipe scroll position 900.

Native animation-frame sampling verified click, tap, Enter and Space activation; the one-second bounce and full-spin keyframes; actual rendered movement; ignored repeat activations during flight; and exact landing without moving the button or logo layout. Reduced motion passed the 180 ms scale-only response. There were no browser runtime errors. Local capability status probes were distinguished from model requests; no live sign-in or AI Chef provider requests were used in browser verification.

Evidence is retained in ignored `artifacts/recipe-gallery-browser-results.json` and `recipe-gallery-{greeting,list,profile,current}-WIDTHxHEIGHT.png`. These are Chromium viewport tests, not physical-device, Safari or kitchen validation.
