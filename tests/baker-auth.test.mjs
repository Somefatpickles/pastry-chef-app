import test from 'node:test';
import assert from 'node:assert/strict';
import { BakerAuthError, readBakerToken, verifyBakerLogin, runBakerChef } from '../server/baker-auth.mjs';

const config = { apiKey: 'fixture-public-project-key', projectId: 'fixture-project', nowSeconds: () => 1000 };
const jwt = (claims = {}, header = {}) => [
  { alg: 'RS256', kid: 'fixture-key', ...header },
  { aud: config.projectId, iss: `https://securetoken.google.com/${config.projectId}`, sub: 'fixture-baker', exp: 2000, iat: 900, auth_time: 800, ...claims },
].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.c2lnbmF0dXJl';
const account = { localId: 'fixture-baker', email: 'baker@example.test', providerUserInfo: [{ providerId: 'password' }] };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const rejectsStatus = status => error => error instanceof BakerAuthError && error.status === status;

test('missing, malformed and oversized bearer credentials fail without lookup', async () => {
  let calls = 0;
  for (const header of [undefined, '', 'Basic abc', 'Bearer a.b', 'Bearer a.b.c, extra', 'Bearer ' + 'a'.repeat(9000)]) {
    await assert.rejects(verifyBakerLogin(header, { ...config, fetchImpl: () => { calls++; } }), rejectsStatus(401));
  }
  assert.equal(calls, 0);
  assert.equal(readBakerToken('bEaReR ' + jwt()), jwt());
});

test('wrong project, expired token, invalid claims and algorithm fail closed before lookup', async () => {
  let calls = 0;
  for (const token of [jwt({ aud: 'other' }), jwt({ iss: 'https://example.test' }), jwt({ exp: 1000 }), jwt({ iat: 2000 }), jwt({ auth_time: 2000 }), jwt({ sub: '' }), jwt({}, { alg: 'none' }), jwt({}, { kid: '' })]) {
    await assert.rejects(verifyBakerLogin('Bearer ' + token, { ...config, fetchImpl: () => { calls++; } }), rejectsStatus(401));
  }
  assert.equal(calls, 0);
});

test('configured project lookup validates token and returns only minimal account identity', async () => {
  const token = jwt();
  let calls = 0;
  const result = await verifyBakerLogin('Bearer ' + token, { ...config, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=fixture-public-project-key');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { idToken: token });
    return response({ users: [{ ...account, passwordHash: 'not-returned', other: 'private' }] });
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { uid: account.localId, email: account.email });
});

test('anonymous, non-password, disabled and mismatched accounts cannot use chef', async () => {
  for (const [user, status] of [[{ ...account, email: undefined }, 403], [{ ...account, providerUserInfo: [] }, 403], [{ ...account, providerUserInfo: [{ providerId: 'google.com' }] }, 403], [{ ...account, disabled: true }, 401], [{ ...account, localId: 'someone-else' }, 401]]) {
    await assert.rejects(verifyBakerLogin('Bearer ' + jwt(), { ...config, fetchImpl: async () => response({ users: [user] }) }), rejectsStatus(status));
  }
});

test('forged or revoked credentials rejected by Firebase cannot authorize', async () => {
  for (const message of ['INVALID_ID_TOKEN', 'TOKEN_EXPIRED', 'USER_DISABLED', 'USER_NOT_FOUND']) await assert.rejects(verifyBakerLogin('Bearer ' + jwt(), { ...config, fetchImpl: async () => response({ error: { message } }, 400) }), rejectsStatus(401));
  await assert.rejects(verifyBakerLogin('Bearer ' + jwt(), { ...config, fetchImpl: async () => response({ users: [] }) }), rejectsStatus(401));
});

test('missing config, provider outages and malformed responses fail closed without leaking diagnostics', async () => {
  await assert.rejects(verifyBakerLogin('Bearer ' + jwt(), {}), rejectsStatus(503));
  for (const fetchImpl of [async () => { throw new Error('secret token diagnostics'); }, async () => response({ error: { message: 'API_KEY_INVALID secret diagnostics' } }, 400), async () => response({}, 503), async () => new Response('not-json')]) {
    await assert.rejects(verifyBakerLogin('Bearer ' + jwt(), { ...config, fetchImpl }), error => rejectsStatus(503)(error) && !/secret|diagnostics/.test(error.message));
  }
});

test('chef boundary never generates or sends recipe context before successful authorization', async () => {
  let adapted = 0;
  const payload = { request: 'Multiply by 2.5' };
  await assert.rejects(runBakerChef(undefined, payload, [], { authConfig: config, adapt: () => { adapted++; } }), rejectsStatus(401));
  assert.equal(adapted, 0);
  const result = await runBakerChef('Bearer ' + jwt(), payload, ['catalog'], { verify: async () => account, adapt: async (received, catalog) => { adapted++; assert.equal(received, payload); assert.deepEqual(catalog, ['catalog']); return { source: 'local' }; } });
  assert.equal(adapted, 1);
  assert.deepEqual(result, { source: 'local' });
});
