# Deployment

CrumbCraft uses [Somefatpickles/pastry-chef-app](https://github.com/Somefatpickles/pastry-chef-app) and the existing [pastry-chef-app Netlify project](https://app.netlify.com/projects/pastry-chef-app/overview). The browser app and its authenticated AI Pastry Chef backend deploy together; Firebase continues to provide accounts and profile synchronization.

The published app is **https://pastry-chef-app.netlify.app/**. The application passed 32 production HTTP smoke checks; use [release notes](release-notes.md) and the project dashboard for the verified release and subsequent deployment records.

The verified target is Netlify project **pastry-chef-app** (`6e755e13-145d-49e0-98c0-6044e6ad70c8`), linked to GitHub repository **Somefatpickles/pastry-chef-app**, production branch **main**. Production builds use that Git connection.

## Netlify configuration

The checked-in `netlify.toml` defines:

- Build command: `npm run build`
- Browser publish directory: `dist`
- Node.js version: **24**
- Generated function data: `.server/recipes.json` and `.server/firebase.json`

The build script runs TypeScript, builds the browser bundle and generates the recipe catalog/public Firebase configuration. Netlify builds API v2 Node.js Function bundles and includes the generated files. Its SDK selects the appropriate dependency tracer for that function format. No single-page-app catch-all redirect is needed because page navigation uses URL fragments.

| Function | Public route | Purpose |
| --- | --- | --- |
| `netlify/functions/chef.mjs` | `POST /api/chef` | Validate the signed-in baker, check quotas and return a recipe proposal or clarification |
| `netlify/functions/chef-status.mjs` | `GET /api/chef/status` | Report availability/model without exposing credentials |
| Scheduled quota cleanup | No app route | Run hourly at **17 minutes past the hour (UTC)**; remove at most 1,000 expired claim keys per run after 48-hour retention |

The standalone `server.mjs` is the local/LAN preview server. Netlify does not execute that long-running listener; its Functions provide the hosted API routes.

## Environment variables

The existing project is on **Netlify Free**. Granular environment scopes are a Pro feature. The owner explicitly approved production-only `OPENAI_API_KEY` and `OPENAI_MODEL` variables with the Free plan's all-scopes access. They are configured in Netlify's standard encrypted environment storage and are available to build/post-processing code and Functions. The OpenAI key has no `VITE_` prefix and is not automatically included in the browser bundle. This setup does not claim Functions-only isolation.

The six existing public Firebase variables were checked against the intended Firebase project and left unchanged, including their scopes and contexts. Node.js 24 comes from `netlify.toml`; no separate AWS runtime override is required. Production status reported the hosted Chef available with `gpt-5-mini`; the 32 published HTTP checks covered configuration health and negative access boundaries without a paid provider request.

Set values in the existing project's environment configuration and configure production/preview contexts intentionally.

| Variables | Use and scope | Notes |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Build-time public configuration; existing Free project uses all scopes | The browser and generated backend auth configuration must use the same Firebase project. |
| `OPENAI_API_KEY` | Backend credential; current owner-approved Free setup uses all scopes, **production context only** | Configured in encrypted Netlify environment storage. Do not give it a `VITE_` prefix or include it in static files. |
| `OPENAI_MODEL` | Optional server configuration; current setup is production-only | Override the default `gpt-5-mini` model. |
| `CHEF_ALLOWED_ORIGINS` | Optional server configuration | Comma-separated additional trusted HTTPS origins. Normal Netlify production, deploy and deploy-preview origins are detected from platform metadata. |

For future hosting changes, the supported credential configurations are:

- **Pro:** configure the key with a Functions-only runtime scope.
- **Free, currently selected and approved:** use a production-only, unprefixed environment variable available to all Netlify scopes. Build and post-processing code can access it as well as Functions; the lack of a `VITE_` prefix prevents automatic inclusion by Vite, but does not restrict access by those build stages.
- **No hosted provider credential:** leave AI Pastry Chef inactive while the other app features remain usable.

`OPENAI_API_KEY_FILE` is a local-server alternative. A developer workstation's filesystem path is not a hosted runtime credential. Keep `.env*`, private key files, QA session artifacts and generated output out of Git.

The server checks the Firebase account through the same project's public authentication configuration. No Firebase administrator key is needed. Enable Email/Password Authentication and Firestore, and allow the intended deployed domains in Firebase Authentication where the project configuration requires it.

## Request controls

The hosted Chef accepts JSON recipe requests only from a trusted app origin. It validates the active email/password Firebase session before recipe processing, including requests that can be handled with local scaling arithmetic. Unauthenticated requests and forged credentials cannot authorize the Chef.

The production adapter applies:

- A native platform limit of **8 requests per 180 seconds** for the configured IP/domain aggregation.
- A durable Netlify Blobs limit of **8 authenticated requests per baker per 10 minutes**, plus **60 requests globally per hour**. Atomic quota claims prevent separate function instances from independently spending the same allowance.
- A maximum request body of **90 KB** with a bounded body-read time.
- Separate limits of **10 seconds** for authentication, **4 seconds** for quota operations and **40 seconds** for the provider request, within a **55-second** overall budget.

Quota-store failures deny requests instead of allowing unmetered provider access. Error/status responses use no-store caching and omit credentials. Cleanup runs hourly at 17 minutes past the hour in UTC, retaining claim keys for 48 hours and removing at most 1,000 expired keys per run. The local preview uses its existing LAN restrictions and in-memory limits; its provider timeout remains a local-development setting.

Netlify quota controls reduce app-side request volume. Configure the appropriate provider/project usage budget for the deployment separately; app limits do not replace the provider's billing controls.

## Firebase data and local copies

`firestore.rules` and `firebase.json` define owner-only access to profile, completion and favorite data. Repository publication and Netlify deployment do not deploy Firebase rules automatically. Existing installations that permit only the parent profile document can use the compatible profile-map fallback; the scalable subcollection layout uses the checked-in rules.

Personal recipe copies remain local to each browser and origin. Export them from the LAN preview and import them at the production hostname if needed. Account-synced history and favorites are separate from the local recipe collection. See [history and sync](favorites-history-and-analytics.md).

## Publish and verify

Use the existing Netlify project rather than creating a replacement. Confirm its linked GitHub repository/production branch, build settings and approved environment-variable configuration, then publish the reviewed revision through the project's deployment workflow. The release source is on GitHub `main`, and production builds use the verified Git connection. If a future deployment omits its OpenAI key, the hosted Chef becomes unavailable without blocking the static app or Firebase profile features.

Release preparation verified the Git connection above and packaged all three Node.js 24 Functions with Netlify's official packaging SDK. The resulting manifests included the API routes, native limit and hourly schedule. Bundle contents excluded local environment files, logs and private QA artifacts; only the required runtime JSON data was included. Extracted packaged handlers rejected a guest Chef request with **401** and returned a safe **200** status response without making a provider request. These are packaging/runtime checks, distinct from observing the updated build live.

Before reporting a release live, verify the production HTML and built assets, generated recipe images, `/api/chef/status`, rejection of unauthenticated/malformed Chef requests, trusted-origin behavior and blocked private-file paths. Browser-review the greeting, four pages, account gate, local saves, favorites and Analytics on the production origin. Authenticated provider requests require a real signed-in test session and incur normal API usage; do not place session tokens in files or logs.

Record the actual site URL, revision, deploy status and observed production checks in [release notes](release-notes.md). A successful build or local preview is not a production-deployment confirmation.
