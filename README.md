# CrumbCraft

A baking companion by **Pixel & Principle**: learn from 68 pastry recipes, keep an ingredient checklist beside the method, adapt a bake with an AI Pastry Chef, and follow your practice over time.

[Live app](https://pastry-chef-app.netlify.app/) · [Repository](https://github.com/Somefatpickles/pastry-chef-app) · [Release notes](docs/release-notes.md) · [Deployment](docs/deployment.md) · [Recipe review](docs/recipe-review.md) · [Validation](docs/validation.md)

## The app

| Page | What you can do |
| --- | --- |
| **Recipe List** | Browse the library or **My recipes**, search titles and ingredients, and combine Category, Skill level, Status and Favorites filters. Star a recipe beside its title without opening it. |
| **Current Recipe** | Follow preparation, method, doneness and storage guidance. Open **Ingredient List / Save** for a separate scrolling checklist, batch multiplier and save controls. Log each finished bake and use the AI Pastry Chef below the review section after signing in. |
| **Profile** | Create an email/password account, sign in, save a first name, and check library-progress and baking-history sync. |
| **Analytics** | After sign-in, explore stacked bars with a cumulative line, date ranges, daily/weekly/monthly groups, category filters and dated bake history. |

The welcome screen fades its elements into focus and greets returning bakers by first name when one is saved. Starting fades the greeting away and brings Recipe List into focus. Four-item bottom navigation slides between pages while retaining their scroll positions. Reduced-motion preferences simplify these effects.

Each library recipe has a 320×200 thumbnail and a 640×400 detail illustration. The 68 images and twelve distinct cookie illustrations were generated for the app; they are illustrations rather than photographs of app recipes after testing. Activating a cookie makes it bounce, spin and fade into another cookie. Library and saved recipes shuffle once per reload, then keep a stable order during the visit.

## Bake, save and return

1. Choose a recipe, or narrow the list with **Status** and **Favorites**. Status follows logged bakes independently of checklist ticks.
2. Keep the right-side ingredient drawer open while reading the method. Its checklist scrolls separately from the recipe, with the multiplier at the top and save controls at the bottom.
3. Choose **Log as completed** after each bake. Every use adds its own timestamp; baking the same recipe next week adds another record. **Undo last log** corrects the latest entry.
4. Save a personal version to **My recipes**. Identical recipe content cannot be saved twice, even under another name; distinct ingredient quantities, method or relevant guidance can be saved as a new version.
5. To rename a local recipe, open it from **My recipes**, edit **Recipe name** in the drawer and choose **Save changes**. Its saved ID, checklists and completion history stay intact.

Recipes display household baking measures: cups, tablespoons, teaspoons, counts, package ounces, inches and Fahrenheit. Ingredient-specific conversions and scaling preserve the recipe's working quantities. A batch multiplier changes ingredient amounts, while oven temperatures and bake times remain tied to portion size, pan depth and doneness cues.

**My recipes** belongs to this browser and origin, including its host and port. Clearing site data, using private browsing or opening another address does not share that collection. Export/import its JSON backup from Recipe List to move copies between browsers. Imports skip identical recipes; the collection holds up to 200 entries. Existing duplicate records are retained so their names and progress are not silently deleted.

## AI Pastry Chef

**Hosted setup:** the Netlify deployment is published, and the hosted Chef status reports available with `gpt-5-mini`. The existing Free project has an owner-approved, production-only OpenAI credential configured. On this plan it is available to build/post-processing code and Functions; it is unprefixed and is not automatically included in the Vite browser bundle. Production checks verified configuration health and access controls without making a paid provider request.

Create an email/password profile or sign in directly in the Chef section to unlock it. Describe a substitution, ingredients to avoid, a serving-size change or another adjustment. Three examples are selected from twelve relevant prompts, and the blue sparkle button in the fixed recipe header scrolls to the Chef.

The Chef returns a proposal with a complete recipe, changes and considerations, or asks for clarification. Review it before **Apply to working recipe**. Applied changes appear in blue; they remain temporary until saved locally. The original library is retained. Natural-language batch requests also support local arithmetic.

The browser sends a Firebase ID token to the backend, which validates the active email/password account before every Chef request. Account passwords go to Firebase. OpenAI receives the working recipe and the request, using structured output and `store: false`; account credentials are not included. The OpenAI key stays on the server.

Substitutions can change structure, hydration, texture, flavor and cooking behavior. Check every ingredient label and shared equipment when avoiding allergens; the Chef cannot guarantee an allergen-free result. Neither the library's revised formulas nor AI adaptations are marked kitchen tested.

## Profiles, history and privacy

No account is needed to browse, use checklists, star recipes, save local copies or log bakes. **AI Pastry Chef** and **Analytics** require a successful email/password sign-in.

Library checklists, completion history and favorites can sync with the signed-in Firebase profile. Bake records retain the title, category and difficulty at the time of logging, so later renaming does not rewrite history. Analytics includes total bakes, bakes by difficulty, bakes by category and distinct recipes, with an accessible table and keyboard/touch period details. Individual history records can be removed to correct mistakes.

Bakes and favorites save locally before cloud upload. Cached or failed cloud connections do not discard those records; Analytics and Profile provide a retry action. Guest activity joins the first profile used in this browser and can later rejoin that same profile. Other profiles keep separate activity caches. Personal recipe copies and working adaptations remain local even when their bake-history snapshots sync.

Firebase uses owner-specific profile data and completion/favorite records. The checked-in [Firestore rules](firestore.rules) support the subcollection layout. Existing installations with profile-document-only rules use a compatible per-ID map fallback, subject to Firestore's document-size limit. See [history and sync details](docs/favorites-history-and-analytics.md).

## Run locally

Use **Node.js 24 or later**.

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill in the public Firebase web-app settings in .env.local.
npm run build
npm test
npm start
```

The build creates the browser bundle in `dist/` and the server catalog/configuration in ignored `.server/`. The Node server serves both the app and its same-origin Chef endpoint, using port **4331** by default. It prints the localhost and LAN addresses; other devices must be on the same network and the host must remain awake.

`npm run dev` starts Vite, proxying `/api` to the Node server. `npm run preview` serves the static bundle only. Run `npm start` when reviewing the Chef locally.

### Configuration

| Variable | Use |
| --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Firebase public web-app configuration, available at build time. Enable Email/Password Authentication and Firestore in the same project. |
| `OPENAI_API_KEY` | OpenAI backend credential. The current Netlify Free project uses the owner-approved production-only environment configuration described below. |
| `OPENAI_API_KEY_FILE` | Optional local-server alternative: a private text-file path read at runtime. |
| `OPENAI_MODEL` | Server model override; the local default is `gpt-5-mini`. |
| `PORT`, `HOST`, `CHEF_ALLOWED_HOSTS` | Local preview listener and allowed-host settings. |
| `CHEF_ALLOWED_ORIGINS` | Optional hosted-backend list of additional trusted HTTPS origins, separated by commas. Normal Netlify deployment origins are detected from the platform. |

For local Chef use, an ignored `.env.server` can supply server settings. Never prefix an OpenAI key with `VITE_`, paste it into client code, or commit it. Environment files, generated server files and private QA artifacts are ignored by Git.

## Deployment

The existing GitHub repository is **Somefatpickles/pastry-chef-app**. Netlify builds with `npm run build`, publishes `dist` and bundles the authenticated Chef as Node.js 24 Functions at `/api/chef` and `/api/chef/status`. Hash-based page navigation requires no catch-all redirect. The local LAN server remains available for development.

The published app is **https://pastry-chef-app.netlify.app/**. Its Netlify project is linked to this repository's **main** branch for production builds. The release source is published to GitHub, and the production application passed **32 HTTP smoke checks**. Publication details are recorded in [release notes](docs/release-notes.md); the project dashboard records subsequent deployments.

The current Netlify Free project retains its existing public `VITE_FIREBASE_*` variables with the plan's all-scopes configuration. The generated catalog and public Firebase authentication configuration are included in the function bundle; no Firebase administrator credential is required. `OPENAI_MODEL` is optional. Never upload local environment files or key-file contents as static assets.

Granular **Functions-only** environment scopes require Netlify Pro. The owner approved the current Free-compatible setup: `OPENAI_API_KEY` and `OPENAI_MODEL` are production-only variables available to all Netlify scopes. Build and post-processing code can access them as well as Functions. The key has no `VITE_` prefix and is not automatically included in the browser bundle. Existing public Firebase variables, their scopes and contexts were preserved. See [deployment](docs/deployment.md) for configuration details.

Production Chef requests validate the Firebase account, restrict request origins and sizes, and use platform and durable per-account/global request limits. The quota store fails closed if unavailable. See [deployment](docs/deployment.md) for setup and limits, and [release notes](docs/release-notes.md) for the verified publication result.

## Verification and recipe provenance

Release verification passed **223 automated tests**, the TypeScript/production build and **32 production HTTP checks**. A fresh network-backed `npm audit` reported **0 vulnerabilities** after compatible dependency updates. The earlier network-review baseline passed **20 LAN checks**; isolated Chromium checks covered **375×812, 320×568, 1280×800 and 844×390**, plus reduced motion, including account isolation, favorites, repeated completion logs, chart totals, saves and drawer behavior. The app owner separately confirmed that cloud sync functions as intended on **October 25, 2026**.

These checks establish software behavior and editorial coverage. They do not establish kitchen results, Safari behavior or physical-device coverage. The initial backend review also exercised actual OpenAI substitution/clarification requests; later browser account flows used isolated fixtures. Current and historical evidence is separated in [validation](docs/validation.md).

All 68 original recipe IDs remain represented. The editorial review covers ingredient balance, complete component quantities, equipment, pan capacity, temperatures, time ranges, doneness, step explanations, cooling and storage, with published technique/formula references. Use the stated cues alongside timing; actual ovens, pans, depth and portions affect results.

| Documentation | Contents |
| --- | --- |
| [Recipe review overview](docs/recipe-review.md) | Coverage, limitations and the three detailed recipe audits |
| [Advanced](docs/review-advanced.md), [middle](docs/review-middle.md), [basics](docs/review-basics.md) reviews | Findings and supporting sources for all 68 recipes |
| [Measurements](docs/measurements.md) | Household-unit conversion and scaling behavior |
| [Favorites, history and Analytics](docs/favorites-history-and-analytics.md) | Profile isolation, repeat events, aggregation and sync |
| [Unique saves](docs/unique-saves-and-notification-motion.md) | Content identity, renaming and notification lifecycle |
| [Artwork provenance](docs/recipe-artwork-manifest.json) | Per-recipe prompts, output files and hashes |
| [Release notes](docs/release-notes.md), [changelog](CHANGELOG.md) | Release scope and deployment record |
| [Deployment](docs/deployment.md) | Netlify build/runtime configuration, authenticated Chef routes and production checks |
| [Validation](docs/validation.md) | Current results, limits and dated revision reports |

Dated interface review reports in `docs/` retain the facts of their original network-review stages; their earlier test counts and no-push statements describe those historical stages.
