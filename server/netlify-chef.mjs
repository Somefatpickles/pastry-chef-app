import { adaptRecipe, ChefError, loadApiKey } from './chef.mjs';
import { BakerAuthError, readBakerToken, runBakerChef, verifyBakerLogin } from './baker-auth.mjs';
import { reserveChefQuota } from './netlify-quota.mjs';

const maximumBodyBytes = 90000;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };
const json = (status, data) => new Response(JSON.stringify(data), { status, headers });

function configuredOrigins(environment, context) {
  const result = new Set();
  for (const value of [environment.URL, environment.DEPLOY_URL, environment.DEPLOY_PRIME_URL, context?.site?.url, ...String(environment.CHEF_ALLOWED_ORIGINS ?? '').split(/[\s,]+/)]) {
    try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) result.add(url.origin); } catch { /* Ignore absent/invalid operator configuration. */ }
  }
  return result;
}

function allowedRequest(request, environment, context) {
  const url = new URL(request.url);
  const development = environment.NETLIFY_DEV === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!development && !configuredOrigins(environment, context).has(url.origin)) return false;
  return request.headers.get('sec-fetch-site') !== 'cross-site' && (!request.headers.has('origin') || request.headers.get('origin') === url.origin);
}

async function readPayload(request, timeoutMs) {
  const declared = request.headers.get('content-length');
  if (declared && /^\d+$/.test(declared) && Number(declared) > maximumBodyBytes) throw new ChefError(413, 'This recipe request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ChefError(400, 'This request could not be read.');
  const chunks = []; let size = 0;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ChefError(408, 'The recipe request took too long to send. Please try again.'));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maximumBodyBytes) { void reader.cancel().catch(() => {}); throw new ChefError(413, 'This recipe request is too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) { throw error instanceof ChefError ? error : new ChefError(400, 'This request could not be read.'); }
  finally { clearTimeout(timer); }
}

async function reserveWithinBudget(storeFactory, uid, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new ChefError(503, 'The chef could not check its usage limits. Please try again later.')); }, timeoutMs);
  });
  try { await Promise.race([reserveChefQuota(storeFactory(), uid, { signal: controller.signal }), timeout]); }
  finally { clearTimeout(timer); }
}

/** Shared public-host boundary; local LAN preview protections remain separate. */
export function createNetlifyChefHandler({ loadRuntime, storeFactory, environment = process.env, getApiKey = loadApiKey, verify = verifyBakerLogin, adapt = adaptRecipe, now = Date.now, quotaTimeoutMs = 4000, bodyTimeoutMs = 5000 } = {}) {
  return async function handler(request, context = {}) {
    try {
      if (!allowedRequest(request, environment, context)) return json(403, { error: 'Open the chef from this app.' });
      const pathname = new URL(request.url).pathname;
      const isStatus = pathname === '/api/chef/status';
      if (pathname !== '/api/chef' && !isStatus) return json(404, { error: 'Endpoint not found.' });
      if ((isStatus && request.method !== 'GET') || (!isStatus && request.method !== 'POST')) return json(405, { error: 'This endpoint does not support that method.' });
      if (!isStatus) readBakerToken(request.headers.get('authorization'));
      const { catalog, authConfig } = await loadRuntime();
      const model = environment.OPENAI_MODEL || 'gpt-5-mini';
      if (isStatus) return json(200, { available: Boolean(await getApiKey()) && Boolean(authConfig?.apiKey && authConfig?.projectId), model });
      const started = now();
      const authorization = request.headers.get('authorization');
      const baker = await verify(authorization, authConfig);
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json(415, { error: 'Send a JSON recipe request.' });
      const payload = await readPayload(request, bodyTimeoutMs);
      return json(200, await runBakerChef(authorization, payload, catalog, {
        authConfig, verify: async () => baker,
        adapt: async (data, recipes) => {
          await reserveWithinBudget(storeFactory, baker.uid, quotaTimeoutMs);
          const timeoutMs = Math.min(40000, 55000 - (now() - started));
          if (timeoutMs < 1000) throw new ChefError(504, 'The AI chef could not connect in time. Your recipe is unchanged. Please try again.');
          return adapt(data, recipes, { apiKey: await getApiKey(), model, timeoutMs });
        },
      }));
    } catch (error) {
      if (error instanceof ChefError || error instanceof BakerAuthError) return json(error.status, { error: error.message });
      return json(503, { error: 'The chef is temporarily unavailable. Your recipe is unchanged. Please try again later.' });
    }
  };
}
