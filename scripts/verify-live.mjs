import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:4331';
const catalog = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
let checks = 0;
const ok = (condition, label) => { assert.ok(condition, label); checks++; console.log(`PASS ${label}`); };
const page = await fetch(base);
ok(page.status === 200, 'LAN app page responds');
const html = await page.text();
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!match[1].startsWith('/')) continue;
  const response = await fetch(base + match[1]); ok(response.ok, `Built asset ${match[1]}`);
  const content = await response.text(); ok(!/sk-(?:proj-)?[A-Za-z0-9_-]{30,}/.test(content), 'No OpenAI secret in asset');
}
for (const route of ['/.env', '/.env.server', '/.git/config', '/server/chef.mjs', '/.server/recipes.json', '/.server/firebase.json']) {
  const response = await fetch(base + route); ok(response.status === 404, `Private route blocked: ${route}`);
}
const status = await (await fetch(base + '/api/chef/status')).json();
ok(typeof status.available === 'boolean' && !JSON.stringify(status).includes('sk-'), 'Chef status excludes credentials');
const recipe = catalog.find(r => r.id === 'classic-chocolate-chip-cookies');
const guest = await fetch(base + '/api/chef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeId: recipe.id, request: 'Multiply all ingredients by 2.5' }) });
ok(guest.status === 401, 'Chef requests require an authenticated baker, including local scaling');
const denied = await guest.json();
ok(typeof denied.error === 'string' && !JSON.stringify(denied).includes('sk-'), 'Guest rejection has safe sign-in guidance');
const fakeIdentity = await fetch(base + '/api/chef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeId: recipe.id, request: 'Adapt this', user: { uid: 'client-claimed-user' } }) });
ok(fakeIdentity.status === 401, 'Client-claimed identity cannot bypass sign-in');
const invalidBearer = await fetch(base + '/api/chef', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' }, body: '{}' });
ok(invalidBearer.status === 401, 'Malformed bearer credentials are rejected');
const firebase = JSON.parse(await readFile(new URL('../.server/firebase.json', import.meta.url)));
const project = firebase.projectId || 'unconfigured-fixture';
const now = Math.floor(Date.now() / 1000);
const forgedToken = [{ alg: 'RS256', kid: 'not-a-real-key' }, { aud: project, iss: `https://securetoken.google.com/${project}`, sub: 'not-a-real-baker', exp: now + 600, iat: now, auth_time: now }].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.ZmFrZS1zaWduYXR1cmU';
const forged = await fetch(base + '/api/chef', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${forgedToken}` }, body: JSON.stringify({ recipeId: recipe.id, request: 'Multiply all ingredients by 2.5' }) });
ok(forged.status === (firebase.apiKey && firebase.projectId ? 401 : 503), 'Well-formed forged credentials cannot authorize a chef request');
const crossOrigin = await fetch(base + '/api/chef', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: '{}' });
ok(crossOrigin.status === 403, 'Cross-origin API request blocked');
if (process.argv.includes('--ai')) {
  const token = process.env.CHEF_TEST_ID_TOKEN;
  if (!token) throw new Error('Set CHEF_TEST_ID_TOKEN to a signed-in Firebase ID token before running paid provider checks.');
  ok(status.available, 'Server can read the configured API key');
  const examples = [];
  for (const request of ['I am out of butter and have refined coconut oil. Adapt this recipe using coconut oil and explain the water balance and texture tradeoffs.', 'Make this dairy-free for a milk allergy. Include all chocolate and cross-contact considerations; I have dairy-free chocolate chips and a dairy-free baking block.']) {
    const response = await fetch(base + '/api/chef', { method: 'POST', signal: AbortSignal.timeout(105000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ recipeId: recipe.id, request }) });
    const result = await response.json();
    ok(response.ok, `Live AI response: ${result.error ?? 'completed'}`);
    ok(result.source === 'openai' && result.recipe.steps.length >= 5 && result.considerations.length > 0, result.questions.length ? 'Live clarification with considerations' : 'Complete live adaptation with considerations');
    if (result.questions.length) ok(JSON.stringify(result.recipe) === JSON.stringify(recipe) && result.changes.length === 0, 'Clarification preserves the original recipe');
    ok(!JSON.stringify(result).match(/sk-[A-Za-z0-9_-]{20,}/), 'Live API response excludes secrets');
    examples.push({ request, result });
  }
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/live-ai-examples.json', JSON.stringify(examples, null, 2));
}
console.log(`${checks} live checks passed.`);
