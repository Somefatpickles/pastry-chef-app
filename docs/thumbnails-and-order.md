# Thumbnails, detail image and per-load ordering — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

Review URL: **http://192.168.1.33:4331/**. Refresh to load the update. No changes have been committed or pushed to GitHub.

Recipe List now requests only the **320×200 thumbnail** for each recipe card, including on high-density displays. Current Recipe displays the selected recipe's **640×400 full image** immediately below its heading, capped at native width and responsive to smaller screens. Saved copies and working adaptations retain the canonical source image through batch scaling. An imported custom recipe without a known library source has no fabricated image.

Library recipes and existing saved recipes receive a new randomized order on each reload. A single immutable Fisher–Yates snapshot supplies stable ranks for that visit. Search, filters, progress, profile edits, page navigation and adaptations preserve the snapshot order. New saves/imports appear after existing ranked entries, and removing a copy preserves the rest. Canonical recipe arrays and stored saved data retain their original structure and IDs.

The compact CrumbCraft wordmark on Recipe List and Profile increases from a 46-pixel to a 52-pixel SVG font. Existing layout widths remain so the larger lettering does not consume more header space. The greeting wordmark keeps its original size, and Current Recipe remains free of branding.

The shuffle helper passed focused checks against the full 68-recipe catalog for exact unique ID coverage, input immutability, retained recipe object references, deterministic random values, and empty/singleton cases. A separate source review found no material issues in the per-load integration or canonical image lookup. The existing **144 automated tests passed with zero failures**.

TypeScript and the final production build passed. All **18 LAN smoke checks** passed against the current built assets.

Isolated Chromium checks passed at **375×812, 320×568, 1280×800 and 844×390**, with all **16 screenshots** visually inspected. All 68 thumbnails decoded at 320×200 with no full-size source candidate, including the separate 2× pixel-density check. Selected and saved-source detail images decoded at 640×400, changed with recipe selection and appeared before preparation guidance. Current Recipe had no branding.

Four page loads produced different complete 68-recipe orders. The order stayed stable through search/filter clearing, navigation, profile changes, progress, saves and collection switching. Compact wordmarks measured 52-pixel SVG fonts with visible glyph growth and no overlap/clipping; the greeting remained 46. Cookie animation landed correctly and the ingredient drawer retained recipe position 900. No browser runtime errors, live sign-in or AI Chef provider requests occurred.

Evidence: ignored `artifacts/thumb-hero-browser-results.json` and `thumb-hero-{greeting,list,profile,current}-WIDTHxHEIGHT.png`. Testing used isolated Chromium, without physical-device or Safari validation.
