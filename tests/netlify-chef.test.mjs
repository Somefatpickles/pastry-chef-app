import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetlifyChefHandler } from '../server/netlify-chef.mjs';
import { reserveChefQuota, cleanupChefQuota } from '../server/netlify-quota.mjs';
import { BakerAuthError, verifyBakerLogin } from '../server/baker-auth.mjs';
import { ChefError } from '../server/chef.mjs';

const origin = 'https://crumbcraft-fixture.netlify.app';
const token = 'header.claims.signature';
const payload = { recipeId: 'fixture-recipe', request: 'Double the recipe.' };
const environment = { URL: origin, DEPLOY_URL: 'https://deploy-fixture.netlify.app', DEPLOY_PRIME_URL: 'https://preview-fixture.netlify.app' };
function memoryStore() {
  const entries = new Map();
  return {
    entries,
    async set(key, value, options) {
      if (options.onlyIfNew && entries.has(key)) return { modified: false };
      entries.set(key, { value, metadata: options.metadata });
      return { modified: true, etag: `etag-${entries.size}` };
    },
    async *list() { yield { blobs: [...entries.keys()].map(key => ({ key })) }; },
    async delete(key) { entries.delete(key); },
  };
}
function fixture(overrides = {}) {
  const calls = { runtime: 0, auth: 0, adapt: 0, store: 0 };
  const store = memoryStore();
  const handler = createNetlifyChefHandler({
    environment,
    loadRuntime: async () => { calls.runtime++; return { catalog: [{ id: 'fixture-recipe' }], authConfig: { apiKey: 'public-fixture-config', projectId: 'fixture-project' } }; },
    getApiKey: async () => 'private-fixture-not-a-real-key',
    storeFactory: () => { calls.store++; return store; },
    verify: async () => { calls.auth++; return { uid: 'fixture-baker', email: 'fixture@example.com' }; },
    adapt: async (data, catalog, options) => { calls.adapt++; calls.data = data; calls.catalog = catalog; calls.options = options; return { source: 'local', recipe: data.recipeId }; },
    ...overrides,
  });
  return { handler, calls, store };
}
function request({ url = '/api/chef', method = 'POST', body = JSON.stringify(payload), headers = {} } = {}) {
  return new Request(`${origin}${url}`, { method, ...(method !== 'GET' && method !== 'HEAD' ? { body } : {}), headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers } });
}

test('Netlify status is secret-free and accepts canonical, deploy and configured custom origins', async () => {
  const { handler, calls } = fixture({ environment: { ...environment, CHEF_ALLOWED_ORIGINS: 'https://baking.example.com' } });
  for (const url of [origin, environment.DEPLOY_URL, environment.DEPLOY_PRIME_URL, 'https://baking.example.com']) {
    const response = await handler(new Request(`${url}/api/chef/status`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { available: true, model: 'gpt-5-mini' });
  }
  assert.equal(calls.auth, 0); assert.equal(calls.store, 0); assert.equal(calls.adapt, 0);
});

test('unknown hosts, cross-origin and cross-site requests fail before runtime/auth/provider work', async () => {
  const { handler, calls } = fixture();
  for (const value of [new Request('https://attacker.example/api/chef/status'), request({ headers: { origin: 'https://attacker.example' } }), request({ headers: { 'sec-fetch-site': 'cross-site' } })]) {
    assert.equal((await handler(value)).status, 403);
  }
  assert.deepEqual(calls, { runtime: 0, auth: 0, adapt: 0, store: 0 });
});

test('unmatched API paths and unsupported methods do not fall through to the app', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request({ url: '/api/missing' }))).status, 404);
  assert.equal((await handler(request({ method: 'GET' }))).status, 405);
  assert.equal((await handler(request({ url: '/api/chef/status' }))).status, 405);
  assert.equal((await handler(request({ url: '/.netlify/functions/chef' }))).status, 404);
  assert.equal(calls.runtime, 0);
});

test('guest and malformed authentication fail before reading body or loading runtime', async () => {
  const { handler, calls } = fixture();
  for (const authorization of ['', 'Bearer forged', 'Basic test']) {
    const value = { url: `${origin}/api/chef`, method: 'POST', headers: new Headers({ authorization }), get body() { throw new Error('Body must not be accessed'); } };
    const response = await handler(value);
    assert.equal(response.status, 401); assert.match((await response.json()).error, /Sign in/);
  }
  assert.deepEqual(calls, { runtime: 0, auth: 0, adapt: 0, store: 0 });
});

test('well-formed forged Firebase credentials cannot allocate quota or reach the provider', async () => {
  const now = Math.floor(Date.now() / 1000);
  const jwt = [Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url'), Buffer.from(JSON.stringify({ aud: 'fixture-project', iss: 'https://securetoken.google.com/fixture-project', sub: 'fixture-baker', iat: now, auth_time: now, exp: now + 3600 })).toString('base64url'), 'forgedsignature'].join('.');
  const { handler, calls } = fixture({ verify: (authorization, config) => verifyBakerLogin(authorization, { ...config, fetchImpl: async () => Response.json({ error: { message: 'INVALID_ID_TOKEN' } }, { status: 400 }) }) });
  assert.equal((await handler(request({ headers: { authorization: `Bearer ${jwt}` } }))).status, 401);
  assert.equal(calls.store, 0); assert.equal(calls.adapt, 0);
});

test('authenticated validation rejects MIME, invalid JSON and both body size boundaries before quota', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request({ headers: { 'content-type': 'text/plain' } }))).status, 415);
  assert.equal((await handler(request({ body: '{broken' }))).status, 400);
  assert.equal((await handler(request({ body: '{}', headers: { 'content-length': '90001' } }))).status, 413);
  assert.equal((await handler(request({ body: 'x'.repeat(90001) }))).status, 413);
  assert.equal(calls.store, 0); assert.equal(calls.adapt, 0);
});

test('valid requests retain the authorization boundary, reserve durable slots and cap provider timeout', async () => {
  const { handler, calls, store } = fixture();
  const response = await handler(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { source: 'local', recipe: 'fixture-recipe' });
  assert.equal(calls.auth, 1); assert.equal(calls.adapt, 1); assert.deepEqual(calls.data, payload);
  assert.equal(calls.options.timeoutMs, 40000); assert.equal(calls.options.model, 'gpt-5-mini');
  assert.equal(store.entries.size, 2);
  assert.ok([...store.entries.keys()].every(key => !key.includes('fixture-baker') && !key.includes('example.com')));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('quota failures fail closed and public error responses never leak internal messages', async () => {
  const { handler, calls } = fixture({ storeFactory: () => ({ set: async () => { throw new Error('private-fixture-not-a-real-key'); } }) });
  const response = await handler(request());
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-fixture/); assert.equal(calls.adapt, 0);
  const failed = fixture({ loadRuntime: async () => { throw new Error('private-path-and-secret'); } });
  const status = await failed.handler(new Request(`${origin}/api/chef/status`));
  assert.equal(status.status, 503); assert.doesNotMatch(await status.text(), /private-path/);
});

test('slow quota operations and body streams time out without calling the provider', async () => {
  const quota = fixture({ quotaTimeoutMs: 5, storeFactory: () => ({ set: () => new Promise(() => {}) }) });
  assert.equal((await quota.handler(request())).status, 503); assert.equal(quota.calls.adapt, 0);
  const body = fixture({ bodyTimeoutMs: 5 });
  const stream = new ReadableStream({ pull() {} });
  const response = await body.handler(new Request(`${origin}/api/chef`, { method: 'POST', body: stream, duplex: 'half', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } }));
  assert.equal(response.status, 408); assert.equal(body.calls.store, 0);
});

test('insufficient remaining runtime returns a clean timeout instead of starting provider work', async () => {
  let calls = 0;
  const { handler, calls: counters } = fixture({ now: () => calls++ === 0 ? 0 : 55000 });
  const response = await handler(request());
  assert.equal(response.status, 504); assert.equal(counters.adapt, 0);
});

test('known provider and authentication failures preserve their safe response status', async () => {
  const auth = fixture({ verify: async () => { throw new BakerAuthError(503, 'Sign-in verification is temporarily unavailable. Please try again.'); } });
  assert.equal((await auth.handler(request())).status, 503);
  const provider = fixture({ adapt: async () => { throw new ChefError(504, 'The AI chef could not connect in time. Your recipe is unchanged.'); } });
  const response = await provider.handler(request()); assert.equal(response.status, 504); assert.match((await response.json()).error, /unchanged/);
});

test('durable quotas share state across instances and allow only eight simultaneous user requests', async () => {
  const store = memoryStore(), now = Date.UTC(2026, 9, 25, 12);
  const attempts = await Promise.allSettled(Array.from({ length: 9 }, () => reserveChefQuota(store, 'same-baker', { now })));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 8);
  assert.equal(attempts.filter(result => result.status === 'rejected' && result.reason.status === 429).length, 1);
  assert.equal([...store.entries.keys()].filter(key => key.startsWith('v1/g/')).length, 8);
  await reserveChefQuota(store, 'same-baker', { now: now + 600000 });
});

test('global hourly quota holds across different authenticated bakers and rolls into a new hour', async () => {
  const store = memoryStore(), now = Date.UTC(2026, 9, 25, 12);
  for (let index = 0; index < 60; index++) await reserveChefQuota(store, `baker-${index}`, { now });
  await assert.rejects(reserveChefQuota(store, 'baker-61', { now }), error => error.status === 429);
  await reserveChefQuota(store, 'baker-61', { now: now + 3600000 });
});

test('storage failures, incomplete write results and aborted claims never grant permission', async () => {
  for (const store of [{ set: async () => { throw new Error('offline'); } }, { set: async () => ({ modified: true }) }, { set: async () => ({ modified: true, etag: '' }) }, { set: async () => null }]) {
    await assert.rejects(reserveChefQuota(store, 'baker'), error => error.status === 503);
  }
  const controller = new AbortController(); controller.abort();
  const store = memoryStore(); await assert.rejects(reserveChefQuota(store, 'baker', { signal: controller.signal }), error => error.status === 503); assert.equal(store.entries.size, 0);
});

test('bounded cleanup only deletes recognized claims older than retention and leaves active data intact', async () => {
  const store = memoryStore(), now = Date.UTC(2026, 9, 28, 12), old = now - 72 * 3600000;
  await reserveChefQuota(store, 'old-baker', { now: old }); await reserveChefQuota(store, 'current-baker', { now });
  store.entries.set('unrelated-record', { value: 'keep' });
  assert.deepEqual(await cleanupChefQuota(store, { now, maxEntries: 1 }), { removed: 1 });
  assert.deepEqual(await cleanupChefQuota(store, { now }), { removed: 1 });
  assert.equal(store.entries.size, 3); assert.ok(store.entries.has('unrelated-record'));
});
