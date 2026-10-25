import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isRecipe, parseAmount, scaleRecipe } from '../shared/recipe-core.mjs';

const recipes = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
const expected = JSON.parse(await readFile(new URL('./original-recipe-ids.json', import.meta.url)));
test('all original recipes are retained exactly once', () => {
  assert.equal(recipes.length, 68);
  assert.deepEqual(recipes.map(r => r.id).sort(), [...expected].sort());
});
for (const recipe of recipes) {
  test(`${recipe.title}: reviewed fields, complete method and scalable quantities`, () => {
    assert.ok(isRecipe(recipe), 'valid recipe data');
    assert.equal(recipe.reviewedOn, '2026-10-24');
    assert.ok(recipe.equipment.length > 0);
    assert.ok(recipe.storage.length > 30);
    assert.ok(recipe.reviewNotes.length > 0);
    assert.ok(recipe.sources.length > 0);
    assert.ok(recipe.steps.length >= 5);
    for (const step of recipe.steps) { assert.ok(step.why?.length > 15, step.title + ' explains context'); assert.ok(step.detail.length > 40, step.title + ' contains instructions'); }
    const scaled = scaleRecipe(recipe, 2.5);
    for (let n = 0; n < recipe.ingredients.length; n++) {
      const amount = parseAmount(recipe.ingredients[n].amount);
      assert.ok(amount, `${recipe.ingredients[n].name} quantity is numeric and unambiguous: ${recipe.ingredients[n].amount}`);
      assert.ok(Math.abs(parseAmount(scaled.ingredients[n].amount).quantity - amount.quantity * (recipe.ingredients[n].scaleWithBatch === false ? 1 : 2.5)) < .00051);
    }
    assert.deepEqual(scaled.steps, recipe.steps, 'batch scaling never multiplies oven temperature or cooking times');
  });
}
test('fractions and mixed quantities parse without losing their unit', () => {
  assert.deepEqual(parseAmount('1/2 tsp'), { quantity: .5, unit: 'tsp' });
  assert.deepEqual(parseAmount('1 1/2 cups'), { quantity: 1.5, unit: 'cups' });
  assert.deepEqual(parseAmount('1½ cups'), { quantity: 1.5, unit: 'cups' });
  assert.deepEqual(parseAmount('⅓ tsp'), { quantity: 1 / 3, unit: 'tsp' });
  assert.deepEqual(parseAmount('0.25 g'), { quantity: .25, unit: 'g' });
  assert.equal(parseAmount('1/0 tsp'), null);
  assert.equal(parseAmount('2–3 cups'), null);
  assert.equal(parseAmount('1 to 2 cups'), null);
  assert.deepEqual(parseAmount('1,000 g'), { quantity: 1000, unit: 'g' });
  assert.equal(parseAmount('as needed'), null);
});
test('repeated saved batch scaling keeps a readable yield and deduplicates considerations', () => {
  let current = recipes[0];
  for (let n = 0; n < 20; n++) current = scaleRecipe(current, 2);
  assert.ok(current.yield.length < 150);
  assert.equal(new Set(current.notes).size, current.notes.length);
  assert.ok(isRecipe(current));
});
test('scaling does not mutate a library recipe, handles fractional eggs, and bounds batch sizes', () => {
  const original = structuredClone(recipes[0]);
  const snapshot = structuredClone(original);
  original.ingredients = [{ id: 'egg', name: 'Large egg', amount: '1' }, { id: 'flour', name: 'Flour', amount: '2 cups' }, { id: 'grease', name: 'Pan grease', amount: 'as needed' }];
  const scaled = scaleRecipe(original, 2.5);
  assert.equal(scaled.ingredients[0].amount, '2.5');
  assert.equal(scaled.ingredients[1].amount, '5 cups');
  assert.match(scaled.ingredients[2].note, /Not scaled/);
  assert.equal(original.ingredients[0].amount, '1');
  assert.deepEqual(original.steps, snapshot.steps);
  for (const invalid of [0, -1, NaN, Infinity, .01, 11]) assert.throws(() => scaleRecipe(original, invalid));
});
test('import validation rejects malformed metadata and duplicate checklist IDs', () => {
  const valid = structuredClone(recipes[0]);
  assert.equal(isRecipe({ ...valid, notes: {} }), false);
  assert.equal(isRecipe({ ...valid, adaptation: { source: 'openai' } }), false);
  assert.equal(isRecipe({ ...valid, sources: [{ title: 'Unsafe', url: 'javascript:alert(1)' }] }), false);
  assert.equal(isRecipe({ ...valid, ingredients: [valid.ingredients[0], valid.ingredients[0]] }), false);
});
