import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adaptRecipe, ChefError, chefInstructions, chefSchema, createAllowedHosts, isAllowedPreviewHost } from '../server/chef.mjs';
import { parseAmount, formatQuantity } from '../shared/recipe-core.mjs';
import { metricUnitPattern, measurementNoticePattern } from '../shared/us-recipe-text.mjs';

const catalog = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
const recipe = catalog[0];
test('provider schema prevents ambiguous quantities before recipe generation', () => {
  const pattern = new RegExp(chefSchema.properties.recipe.properties.ingredients.items.properties.amount.pattern);
  for (const valid of ['8 oz', '0.5 tsp', '2', '1.25 cups', '2 fl oz']) assert.ok(pattern.test(valid), valid);
  for (const invalid of ['125 g', '35 ml', '1 l', '0 oz', '1 to 2 cups', '1 cup (120 g)', '0', '1/2 tsp']) assert.equal(pattern.test(invalid), false, invalid);
});
function fixtureAmount(ingredient) {
  const amount = parseAmount(ingredient.amount);
  if (amount?.unit === 'g') return formatQuantity(amount.quantity / 28.349523125) + ' oz';
  if (amount?.unit === 'ml') return formatQuantity(amount.quantity / 240) + ' cups';
  return ingredient.amount;
}
const proposedRecipe = {
  title: recipe.title, blurb: recipe.blurb, time: recipe.time, yield: recipe.yield,
  equipment: recipe.equipment, storage: recipe.storage, notes: recipe.notes,
  ingredients: recipe.ingredients.map(i => ({ name: i.name, amount: fixtureAmount(i), note: i.note ?? '', scaleWithBatch: i.scaleWithBatch !== false })),
  steps: recipe.steps.map(s => ({ title: s.title, detail: s.detail, why: s.why, tip: s.tip ?? '' })),
};
const proposal = { summary: 'Use a baking block.', changes: ['Replaced the butter.'], considerations: ['Read labels and check shared equipment.'], questions: [], recipe: proposedRecipe };
const response = data => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }), { status: 200 });
const callWithProposal = output => adaptRecipe({ recipeId: recipe.id, request: 'Adapt this with coconut oil.' }, catalog, { apiKey: 'test-only-key', fetchImpl: async () => response(output) });
test('a pure 2.5× request uses local arithmetic without sending an API call', async () => {
  const result = await adaptRecipe({ recipeId: recipe.id, request: 'Multiply all ingredients by 2.5' }, catalog, { fetchImpl: () => { throw new Error('Should not call AI'); } });
  assert.equal(result.source, 'local'); assert.equal(result.questions.length, 0);
  assert.deepEqual(result.recipe.steps, recipe.steps);
});
test('API request uses strict structured output, does not store the response, and sends only recipe context', async () => {
  let payload;
  const result = await adaptRecipe({ recipeId: recipe.id, request: 'I have no butter. Adapt this recipe.' }, catalog, { apiKey: 'test-only-key', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key'); payload = JSON.parse(options.body); return response(proposal);
  } });
  assert.equal(payload.store, false); assert.equal(payload.text.format.strict, true);
  assert.equal(JSON.parse(payload.input).originalRecipe.id, recipe.id);
  assert.ok(JSON.parse(payload.input).originalRecipe.ingredients.every(i => !metricUnitPattern.test(i.amount)));
  assert.ok(!JSON.stringify(payload).includes('test-only-key'));
  assert.ok(!JSON.stringify(result).includes('test-only-key'));
  assert.equal(result.source, 'openai'); assert.equal(result.recipe.ingredients[0].id, 'adapt-ingredient-1');
  assert.match(chefInstructions, /Never multiply oven temperature/);
  assert.equal(chefSchema.properties.recipe.properties.ingredients.items.properties.scaleWithBatch.type, 'boolean');
  assert.ok(chefSchema.properties.recipe.properties.ingredients.items.required.includes('scaleWithBatch'));
  assert.match(chefInstructions, /deep-frying oil bath or water bath/);
});
test('clarification questions preserve the current recipe and do not silently apply changes', async () => {
  const result = await adaptRecipe({ recipeId: recipe.id, request: 'Make this allergy friendly.' }, catalog, { apiKey: 'test-only-key', fetchImpl: async () => response({ ...proposal, questions: ['Which allergen must you avoid?'] }) });
  assert.deepEqual(result.recipe, recipe); assert.equal(result.questions.length, 1);
});

test('question-only responses do not need an actionable generated recipe', async () => {
  const result = await callWithProposal({ ...proposal, changes: ['An unconfirmed change must not apply.'], questions: ['Which allergen must you avoid?'], recipe: null });
  assert.deepEqual(result.recipe, recipe);
  assert.deepEqual(result.changes, []);
  const current = { ...recipe, title: 'My current working version' };
  const currentResult = await adaptRecipe({ recipeId: recipe.id, recipe: current, request: 'Adapt for my allergy.' }, catalog, { apiKey: 'test-only-key', fetchImpl: async () => response({ ...proposal, questions: ['Which allergen?'], recipe: { ingredients: [], steps: [] } }) });
  assert.deepEqual(currentResult.recipe, current);
});

test('model output cannot replace source ancestry, review metadata, IDs, or unrelated fields', async () => {
  const malicious = structuredClone(proposal);
  Object.assign(malicious, { source: 'untrusted', model: 'fake', apiKey: 'fake-secret' });
  Object.assign(malicious.recipe, { id: 'wrong', difficulty: 'Challenges', category: 'Wrong', sourceRecipeId: 'wrong', sources: [{ title: 'Wrong', url: 'https://example.com' }], reviewedOn: '2099-01-01', reviewNotes: ['Wrong'], adaptation: { source: 'wrong' }, apiKey: 'fake-secret' });
  malicious.recipe.ingredients[0].id = 'wrong';
  malicious.recipe.ingredients[0].unrelated = 'untrusted';
  malicious.recipe.steps[0].unrelated = 'untrusted';
  const result = await callWithProposal(malicious);
  for (const field of ['id', 'difficulty', 'category', 'sourceRecipeId', 'sources', 'reviewedOn', 'reviewNotes', 'adaptation']) assert.deepEqual(result.recipe[field], recipe[field], field);
  assert.equal(result.source, 'openai');
  assert.equal(result.model, process.env.OPENAI_MODEL || 'gpt-5-mini');
  assert.equal(result.apiKey, undefined);
  assert.equal(result.recipe.apiKey, undefined);
  assert.equal(result.recipe.ingredients[0].id, 'adapt-ingredient-1');
  assert.equal(result.recipe.ingredients[0].unrelated, undefined);
  assert.equal(result.recipe.steps[0].unrelated, undefined);
});

test('generated quantities must be unambiguous and each scaling flag must be boolean', async () => {
  for (const amount of ['1 to 2 cups', '1–2 cups', 'as needed', '0 g', '125 g', '500 ml', '1/0 tsp', '1 cup (120 g)', '2 cups plus 1 tbsp']) {
    const invalid = structuredClone(proposal); invalid.recipe.ingredients[0].amount = amount;
    await assert.rejects(callWithProposal(invalid), error => error instanceof ChefError && error.status === 502, amount);
  }
  for (const flag of [undefined, 'false', 0, null]) {
    const invalid = structuredClone(proposal); invalid.recipe.ingredients[0].scaleWithBatch = flag;
    await assert.rejects(callWithProposal(invalid), error => error instanceof ChefError && error.status === 502);
  }
});

test('unambiguous thousands grouping remains correctly scalable after a proposal', async () => {
  const output = structuredClone(proposal);
  output.recipe.ingredients[0].amount = '1,000 oz';
  const result = await callWithProposal(output);
  const scaled = await adaptRecipe({ recipeId: recipe.id, recipe: result.recipe, request: 'Multiply all ingredients by 2.5' }, catalog);
  assert.equal(scaled.recipe.ingredients[0].amount, '2500 oz');
});

test('equipment allowances survive AI output and remain fixed in later local batch changes', async () => {
  const output = structuredClone(proposal);
  output.recipe.ingredients.push({ name: 'Oil for deep-frying bath', amount: '6 cups', note: 'Equipment allowance: maintain 2 inches in the same pot for each batch.', scaleWithBatch: false });
  const result = await callWithProposal(output);
  assert.equal(result.recipe.ingredients.at(-1).scaleWithBatch, false);
  const scaled = await adaptRecipe({ recipeId: recipe.id, recipe: result.recipe, request: 'Multiply all ingredients by 2.5' }, catalog);
  assert.equal(scaled.recipe.ingredients.at(-1).amount, '6 cups');
});
test('nonfood supplies move to equipment and AI yield resets its scaling base', async () => {
  const output = structuredClone(proposal);
  output.recipe.ingredients.push({ name: 'Parchment paper for lining', amount: '1', note: 'Line the sheets.', scaleWithBatch: true });
  const result = await callWithProposal(output);
  assert.ok(!result.recipe.ingredients.some(i => i.name.includes('Parchment')));
  assert.ok(result.recipe.equipment.some(i => i.includes('Parchment')));
  assert.equal(result.recipe.batchScale, 1);
  assert.equal(result.recipe.baseYield, result.recipe.yield);
});
test('AI method references use measured ingredient amounts while portion weights and oven temperatures stay fixed', async () => {
  const output = structuredClone(proposal);
  output.recipe.ingredients.push({ name: 'Water', amount: '2 tbsp', note: '', scaleWithBatch: true });
  output.recipe.steps[0].detail = 'Add the 2 tbsp water to the mixture, then portion into 1 oz cookies and bake at 350°F for 12 minutes.';
  const result = await callWithProposal(output);
  assert.match(result.recipe.steps[0].detail, /the measured water/);
  assert.ok(!result.recipe.steps[0].detail.includes('2 tbsp'));
  assert.match(result.recipe.steps[0].detail, /1 oz cookies/);
  assert.match(result.recipe.steps[0].detail, /350°F for 12 minutes/);
});
test('AI guidance and legacy prose cannot reintroduce metric units or measurement notices', async () => {
  const output = structuredClone(proposal);
  output.summary = 'Replace 227 g butter and add 36 mL water.';
  output.changes = ['Use 182 grams coconut oil.'];
  output.considerations = ['This is an approximation. Keep at 40°F / 4°C.'];
  output.recipe.steps[0].detail = 'Roll to 20 cm and bake at 175°C for 12 minutes.';
  output.recipe.ingredients[0].note = 'Approximate cup/spoon equivalent. Weigh in grams.';
  const result = await callWithProposal(output);
  for (const text of [result.summary, ...result.changes, ...result.considerations, ...result.recipe.steps.map(s => s.detail), ...result.recipe.ingredients.map(i => i.note)]) {
    assert.ok(!metricUnitPattern.test(text), text);
    assert.ok(!measurementNoticePattern.test(text), text);
  }
  const question = await callWithProposal({ ...output, questions: ['Do you have 100 grams of butter?'] });
  assert.ok(!metricUnitPattern.test(question.questions[0]));
  assert.deepEqual(question.recipe, recipe);
});

test('summary and guidance fields are bounded and typed, including clarifications', async () => {
  for (const change of [
    { summary: '' }, { summary: 'x'.repeat(1001) }, { changes: 'bad' }, { changes: [null] },
    { changes: Array(31).fill('too many') }, { considerations: ['x'.repeat(2001)] },
    { questions: Array(9).fill('too many') }, { questions: [''] },
    { changes: Array(6).fill('x'.repeat(1900)) },
  ]) await assert.rejects(callWithProposal({ ...proposal, ...change }), error => error instanceof ChefError && error.status === 502);
});

test('malformed provider envelopes fail with a safe ChefError rather than raw exceptions', async () => {
  for (const data of [null, [], {}, { status: 'completed', output: {} }, { status: 'completed', output: [null] }, { status: 'completed', output: [{ content: {} }] }, { status: 'completed', output: [{ content: [null] }] }, { status: 'completed', output: [{ content: [{ type: 'output_text', text: {} }] }] }, { status: 'completed', output: [{ content: [{ type: 'output_text', text: 'not JSON' }] }] }]) {
    await assert.rejects(adaptRecipe({ recipeId: recipe.id, request: 'Use oil.' }, catalog, { apiKey: 'test-only-key', fetchImpl: async () => new Response(JSON.stringify(data)) }), error => error instanceof ChefError && error.status === 502);
  }
  for (const value of [null, 5, [], { ...proposal, recipe: { ...proposedRecipe, ingredients: [null] } }, { ...proposal, recipe: { ...proposedRecipe, steps: [null] } }]) await assert.rejects(callWithProposal(value), error => error instanceof ChefError && error.status === 502);
});

test('preview hosts include only loopback, actual interfaces and explicit valid hostnames', () => {
  const hosts = createAllowedHosts({ Ethernet: [{ address: '192.168.1.33' }, { address: 'fd12::1' }] }, 'BAKER.local, pastry-kitchen, https://evil.example, *.evil.example, example.com:4331, 203.0.113.9');
  for (const header of ['localhost:4331', '127.0.0.1:4331', '[::1]:4331', '192.168.1.33:4331', '[fd12::1]:4331', 'baker.local:4331', 'pastry-kitchen']) assert.equal(isAllowedPreviewHost(header, hosts), true, header);
  for (const header of ['evil.example:4331', 'localhost.evil.example', '192.168.1.44:4331', 'example.com:4331', '203.0.113.9', 'localhost@evil.example', 'localhost/path', 'localhost\\evil', 'localhost?x', 'localhost#x', ' localhost', 'localhost:99999', undefined]) assert.equal(isAllowedPreviewHost(header, hosts), false, String(header));
});
test('unknown recipes, malformed drafts and oversized instructions are rejected before a provider call', async () => {
  for (const payload of [{ recipeId: 'missing', request: 'Change it' }, { recipeId: recipe.id, request: '' }, { recipeId: recipe.id, request: 'x'.repeat(2001) }, { recipeId: recipe.id, request: 'Change it', recipe: {} }]) {
    await assert.rejects(adaptRecipe(payload, catalog), error => error instanceof ChefError && error.status === 400);
  }
});
test('provider failures, incomplete output and malformed output leave the recipe unchanged', async () => {
  for (const fake of [new Response('{}', { status: 401 }), new Response('{}', { status: 429 }), new Response(JSON.stringify({ status: 'incomplete' })), response({ ...proposal, recipe: { ingredients: [], steps: [] } })]) {
    await assert.rejects(adaptRecipe({ recipeId: recipe.id, request: 'Use oil in place of butter' }, catalog, { apiKey: 'test-only-key', fetchImpl: async () => fake }), error => error instanceof ChefError);
  }
});
