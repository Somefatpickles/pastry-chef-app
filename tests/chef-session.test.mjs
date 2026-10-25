import test from 'node:test';
import assert from 'node:assert/strict';
import { ChefSessionEndedError, hasChefAccount, requestChefWithSession } from '../shared/chef-session.mjs';

test('the chef requires a nonanonymous email and password account', () => {
  const valid = { isAnonymous: false, email: 'baker@example.test', providerData: [{ providerId: 'password' }] };
  assert.equal(hasChefAccount(valid), true);
  assert.equal(hasChefAccount(null), false);
  assert.equal(hasChefAccount({ ...valid, isAnonymous: true }), false);
  assert.equal(hasChefAccount({ ...valid, email: null }), false);
  assert.equal(hasChefAccount({ ...valid, providerData: [{ providerId: 'google.com' }] }), false);
});

test('chef submissions attach the current ID token to the same-origin request', async () => {
  let called = 0;
  const response = await requestChefWithSession({
    user: { getIdToken: async refresh => { assert.equal(refresh, false); return 'test-id-token'; } },
    payload: { request: 'Scale by 2.5' }, isCurrent: () => true,
    fetchImpl: async (url, init) => {
      called++;
      assert.equal(url, '/api/chef');
      assert.equal(init.headers.Authorization, 'Bearer test-id-token');
      assert.deepEqual(JSON.parse(init.body), { request: 'Scale by 2.5' });
      return new Response('{}', { status: 200 });
    },
  });
  assert.equal(called, 1);
  assert.equal(response.status, 200);
});

test('an expired token refreshes once and a second unauthorized response stops', async () => {
  const tokenCalls = [];
  const headers = [];
  const response = await requestChefWithSession({
    user: { getIdToken: async refresh => { tokenCalls.push(refresh); return refresh ? 'fresh' : 'cached'; } },
    payload: {}, isCurrent: () => true,
    fetchImpl: async (url, init) => { assert.equal(url, '/api/chef'); headers.push(init.headers.Authorization); return new Response('{}', { status: 401 }); },
  });
  assert.deepEqual(tokenCalls, [false, true]);
  assert.deepEqual(headers, ['Bearer cached', 'Bearer fresh']);
  assert.equal(response.status, 401);
});

test('sign-out while a token is being obtained prevents any chef submission', async () => {
  let current = true;
  let calls = 0;
  await assert.rejects(requestChefWithSession({
    user: { getIdToken: async () => { current = false; return 'old-token'; } },
    payload: {}, isCurrent: () => current,
    fetchImpl: async () => { calls++; return new Response('{}'); },
  }), ChefSessionEndedError);
  assert.equal(calls, 0);
});

test('a reply from an account that signed out cannot become a chef proposal', async () => {
  let current = true;
  await assert.rejects(requestChefWithSession({
    user: { getIdToken: async () => 'token' }, payload: {}, isCurrent: () => current,
    fetchImpl: async () => { current = false; return new Response('{"summary":"late"}'); },
  }), ChefSessionEndedError);
});

test('aborting before submission or between a 401 and refresh blocks further requests', async () => {
  const aborted = new AbortController(); aborted.abort();
  let calls = 0;
  await assert.rejects(requestChefWithSession({ user: { getIdToken: async () => 'token' }, payload: {}, isCurrent: () => true, signal: aborted.signal, fetchImpl: async () => { calls++; return new Response('{}'); } }), ChefSessionEndedError);
  assert.equal(calls, 0);
  const controller = new AbortController();
  let tokens = 0;
  await assert.rejects(requestChefWithSession({
    user: { getIdToken: async () => { tokens++; return 'token'; } }, payload: {}, isCurrent: () => true, signal: controller.signal,
    fetchImpl: async () => { calls++; controller.abort(); return new Response('{}', { status: 401 }); },
  }), ChefSessionEndedError);
  assert.equal(tokens, 1);
  assert.equal(calls, 1);
});
