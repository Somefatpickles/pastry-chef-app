# Accounts, action notifications and cookie transitions — October 24, 2026

> Historical review note. The local URL, test count and publication status below describe this document's original review stage. See [release notes](release-notes.md) and [validation](validation.md) for current release information.

Review URL: **http://192.168.1.33:4331/**. Refresh the app. No changes have been committed or pushed to GitHub.

## AI Pastry Chef enrollment

Guests see inline Email and Password fields in the recipe's AI Pastry Chef section. Account creation is the default, with an existing-account Sign in option. Success unlocks the usable Chef form and shows a temporary message explaining that Profile contains further profile settings. Anonymous and non-password-only sessions remain gated. Profile retains its own account form, and both forms route validation and failure feedback to the new notifications.

The client obtains the current Firebase ID token for each Chef POST, refreshes once after a 401, and aborts or discards work when the account changes or signs out. Applying a result also checks the current account. A signed-out user cannot retain or apply a late proposal. Ordinary recipe browsing, checklists, local saves and the drawer multiplier remain available without an account.

The server rejects unauthenticated requests before generation, including natural-language scaling calls. It checks token structure, issuer, audience and time claims as an early rejection step, then asks Firebase's fixed HTTPS account-lookup endpoint to validate the credential. The returned user must match the token subject, be active, have an email, and have an email/password provider. Local token decoding alone never authorizes a request. Network/configuration failures fail closed. Passwords and account information are not added to the model payload.

The build writes the same public Firebase project/key used by the production client into ignored `.server/firebase.json`; the Node server reads it at startup. It is not served by the static app. No new administrator credential was introduced. Implementation references: [Firebase REST account lookup](https://firebase.google.com/docs/reference/rest/auth#section-get-account-info), [Firebase ID-token guidance](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## Floating action feedback

Action success, error and informational feedback now appears in cards fixed at the top center, with an X to dismiss. Success/info cards last eight seconds and errors ten seconds; hovering or focusing pauses their remaining lifetime. At most three are shown, with duplicate messages refreshed. Error cards announce as alerts and other cards as statuses without taking focus.

When the ingredient drawer is open, the notification stack is portaled inside the native dialog's top layer. The X remains visible and keyboard-reachable, dismissal restores a usable prior control, and messages do not add height to the recipe or shift its reading position. Closing the drawer moves an active notification back to the page layer. Busy indicators, Chef proposals and continuing sync status remain normal feature content rather than transient action results.

## Cookie morph

Each cookie activation selects a different random asset and decodes it before movement. Two image layers crossfade during the one-second bounce/full spin; the incoming DOM image is retained at landing to avoid a blank handoff. The completed choice is shared across the greeting, Recipe List and Profile. Repeat activations during loading or flight are ignored, and stale/unmounted work is cancelled. Reduced motion uses a short 180 ms fade/scale response. Cookie and wordmark geometry stay fixed.

## Verification

**164 automated tests passed, zero failed**, including new server authorization, client session-race and notification timer/lifecycle tests. TypeScript and the production build passed. **20 live LAN checks** passed, including actual guest/malformed/forged-token rejection and blocking the new private Firebase configuration path. An intentionally invalid token also confirmed the configured project's Firebase lookup endpoint rejected invalid credentials without creating an account.

Final isolated Chromium checks passed at **375×812, 320×568, 1280×800 and 844×390**. All **21 final screenshots** were visually inspected. They covered inline account creation/sign-in and failures, the Profile hint, authenticated Bearer requests and token refresh, applying results, sign-out and late replies, toast layering/X/Tab/focus/expiry/pause, reading-position preservation, two-layer cookie opacity and flight, repeated-tap guards, shared cookie changes, reduced motion and unmounts. Thumbnail/detail-image roles and stable per-load recipe ordering also passed. There were no browser runtime errors.

Browser account and Chef calls used intercepted fixtures: **no live accounts, profile writes or paid Chef requests were created**. Live positive enrollment and physical-device/Safari behavior were not exercised. The negative server-access checks used the real preview server. Evidence is retained in a private, ignored browser QA report, its reproducible harness and screenshots. A separate native-modal notification harness also passed overlay, focus, expiry and host-reparenting checks.
