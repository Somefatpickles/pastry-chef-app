# Release notes — CrumbCraft

## October 25, 2026

CrumbCraft brings the existing Pastry Chef App library into a complete baking workflow: choose a recipe, keep its ingredient checklist beside the method, adapt and save a distinct version, log each bake, and follow progress in a signed-in profile.

The release includes all 68 reviewed recipes, generated recipe illustrations and twelve cookie assets; four-page navigation; household baking measures; local unique saves and renaming; favorites and completion filters; authenticated AI Pastry Chef; and dated repeat-bake history with Analytics.

## Publication

- Repository: [Somefatpickles/pastry-chef-app](https://github.com/Somefatpickles/pastry-chef-app)
- Source branch: [main](https://github.com/Somefatpickles/pastry-chef-app/tree/main), with revisions in [Git history](https://github.com/Somefatpickles/pastry-chef-app/commits/main/)
- Production host: the existing [pastry-chef-app Netlify project](https://app.netlify.com/projects/pastry-chef-app/overview)
- Existing production URL: [pastry-chef-app.netlify.app](https://pastry-chef-app.netlify.app/)
- Build: `npm run build`
- Browser output: `dist/`
- Backend: Node.js 24 Netlify Functions at `/api/chef` and `/api/chef/status`

**Release state:** prepared for production deployment. Netlify authentication and the existing project's GitHub **main** production connection were verified. The production URL was verified to serve the earlier build before this update; that check alone does not confirm publication of the new build. The Netlify project dashboard records the exact deployment status and source revision.

Firebase public configuration belongs in Netlify's **Builds** scope. `OPENAI_API_KEY` belongs only in the protected **Functions** runtime scope; `OPENAI_MODEL` is optional. The build generates the catalog and public Firebase configuration included in the function bundle. The local preview server remains a separate development option. The production adapter validates Firebase sessions and uses native request limits plus a durable Netlify Blobs quota. See [deployment](deployment.md) for setup and production checks.

## Verification

Final release verification passed **223 automated tests** and the TypeScript/production build, including **15 Netlify adapter/quota tests** beyond the earlier 208-test baseline. A fresh network-backed dependency audit reported **0 vulnerabilities** after the compatible security updates.

Official Netlify packaging produced all three API v2 Node.js 24 Function bundles with the expected routes, native request limit and hourly cleanup schedule. The bundles excluded environment files, logs and private QA artifacts. Extracted handlers passed guest rejection (**401**) and safe status (**200**) checks without a provider request. Published HTTP checks remain separate from these preparation checks.

The completed network review passed **20 LAN checks**, four Chromium viewport sizes and reduced motion. Those browser flows covered welcome transitions, four-page navigation, stars/filters, repeat bake records, account isolation, reload persistence, chart/table totals, local saves and drawer scrolling. Browser asset hashes were unchanged by the final hosting/dependency maintenance.

The app owner separately confirmed that cloud sync works as intended on **October 25, 2026**. Automated account/browser checks used isolated fixtures. Production deployment checks must be recorded above separately from this baseline.

## Existing data

Local saved recipes remain tied to the browser and origin where they were created. A production hostname and a LAN preview address have separate local collections; use Recipe List's export/import backup to move recipes.

Name-only local recipe changes retain their saved IDs and progress. Identical new saves/imports are skipped without deleting older duplicate records. Earlier single completion dates can be migrated as the one date actually retained; missing past repeats cannot be reconstructed. New completions are separate dated events.

History and favorites keep account-specific local caches and sync with the profile. Guest data joins the first profile used in this browser and can later rejoin that same profile; it is not copied into another account.

## Dependency maintenance

Compatible updates select Vite **7.3.7** and source-map-js **1.2.2**. A scoped `@firebase/firestore` override resolves `@grpc/grpc-js` to **1.14.6**, a patched same-major dependency instead of the older Node-only range pinned upstream. Firebase remains **12.19.0**. The browser Firestore SDK is unchanged, and the Chef backend authenticates through REST rather than that Node client. Re-evaluate and remove the override when the upstream Firebase package supports the patched range directly, then rerun the tests and build.

## Recipe and image provenance

The recipe formulas and methods were reviewed against published references, with coverage in [the recipe review](recipe-review.md). They are editorially revised formulations, not kitchen-tested results. The recipe images are generated illustrations, not photographs of test bakes. AI adaptations need the same practical review, including ingredient-label and shared-equipment checks when avoiding allergens.

For setup and day-to-day use, see [README](../README.md). For detailed evidence and limits, see [validation](validation.md).
