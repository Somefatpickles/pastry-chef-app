import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { displayIngredientAmount } from '../shared/baking-measures.mjs';
import { scaleRecipe } from '../shared/recipe-core.mjs';
import { toUsText, toUsRecipe, toUsChefResult, metricUnitPattern, measurementNoticePattern } from '../shared/us-recipe-text.mjs';

const catalog = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
function visibleStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => visibleStrings(item, `${path}.${index}`));
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => !['id', 'url', 'sourceRecipeId', 'createdAt', 'reviewedOn', 'model', 'source'].includes(key)).flatMap(([key, item]) => visibleStrings(item, `${path}.${key}`));
  return [];
}

test('paired oven, refrigerator and pan measurements keep only their existing customary value', () => {
  assert.equal(toUsText('Bake at 350°F / 175°C for 20 minutes.'), 'Bake at 350°F for 20 minutes.');
  assert.equal(toUsText('Keep at 40°F / 4°C or colder.'), 'Keep at 40°F or colder.');
  assert.equal(toUsText('Roll to 8 × 24 inches / 20 × 60 cm, then fold.'), 'Roll to 8 × 24 inches, then fold.');
  assert.equal(toUsText('Use a 9-inch (23 cm) pan.'), 'Use a 9-inch pan.');
  assert.equal(toUsText('Cook at 160–170°F / 71–77°C.'), 'Cook at 160–170°F.');
  assert.equal(toUsText('Freeze at 0°F / -18°C.'), 'Freeze at 0°F.');
});

test('standalone temperature ranges, negative temperatures and metric dimensions convert correctly', () => {
  assert.equal(toUsText('Heat to 100°C.'), 'Heat to 212 °F.');
  assert.equal(toUsText('Freeze at -18°C.'), 'Freeze at 0 °F.');
  assert.equal(toUsText('Hold at 20–25°C.'), 'Hold at 68–77 °F.');
  assert.equal(toUsText('Cut a 25.4 × 50.8 mm rectangle.'), 'Cut a 1 × 2 inches rectangle.');
  assert.equal(toUsText('Use 2.54 centimeters of clearance.'), 'Use 1 inch of clearance.');
});

test('prose uses ingredient-specific measures when named rather than one density for every food', () => {
  assert.equal(toUsText('Add 120 g flour and 113 g butter.'), 'Add 1 cup flour and 1/2 cup butter.');
  assert.equal(toUsText('Add 15 mL water and 240 milliliters milk.'), 'Add 1 tbsp water and 1 cup milk.');
  assert.equal(toUsText('Measure 1 liter water.'), 'Measure 4 1/8 cups water.');
  const ingredients = [{ id: 'sugar', name: 'Light brown sugar', amount: '213 g' }];
  assert.equal(toUsText('Light brown sugar: 213 g.', { ingredients }), 'Light brown sugar: 1 cup.');
  const unknown = toUsText('Add 100 grams specialty powder.');
  assert.match(unknown, /oz specialty powder/);
  assert.ok(!metricUnitPattern.test(unknown));
});

test('unit-only words and legacy measurement notices are cleaned without deleting safety context', () => {
  const text = toUsText('Approximate cup/spoon equivalent. Use level spoons. Precise original amount: 7 g. Keep refrigerated and check ingredient labels.');
  assert.equal(text, 'Use level spoons. Keep refrigerated and check ingredient labels.');
  assert.equal(toUsText('Measure in grams and milliliters; set the oven in Celsius.'), 'Measure in ounces and cups; set the oven in Fahrenheit.');
  assert.equal(toUsText('This is an approximation. This recipe has not been kitchen tested.'), 'This recipe has not been kitchen tested.');
  assert.equal(toUsText('Add approx. 120 g flour.'), 'Add 1 cup flour.');
  assert.equal(toUsText('Leave two centimeters of space.'), 'Leave 0.79 inches of space.');
  assert.equal(toUsText('Add half a liter water.'), 'Add 2 cups + 1 tbsp + 1 tsp water.');
});

test('all recipe display fields across the complete original and scaled library contain no metric units or measurement notices', () => {
  let count = 0;
  for (const recipe of catalog) for (const factor of [1, .5, 2.5]) {
    const raw = scaleRecipe(recipe, factor);
    const original = structuredClone(raw);
    const display = toUsRecipe(raw);
    for (const [path, value] of visibleStrings(display)) {
      assert.ok(!metricUnitPattern.test(value), `${recipe.id}${path}: ${value}`);
      assert.ok(!measurementNoticePattern.test(value), `${recipe.id}${path}: ${value}`);
      assert.ok(!/NaN|Infinity/.test(value), `${recipe.id}${path}: ${value}`);
    }
    assert.deepEqual(raw, original, 'projection never changes saved/scaled source data');
    assert.deepEqual(display.ingredients.map(item => item.id), raw.ingredients.map(item => item.id));
    assert.deepEqual(display.sources?.map(source => source.url), raw.sources?.map(source => source.url));
    count += display.ingredients.length;
  }
  assert.equal(catalog.length, 68);
  assert.equal(count, 2082);
});

test('all ingredient conversion notes use handling guidance without metric originals or approximation caveats', () => {
  for (const recipe of catalog) for (const ingredient of recipe.ingredients) {
    const display = displayIngredientAmount(ingredient);
    for (const value of [display.amount, display.note ?? '']) {
      assert.ok(!metricUnitPattern.test(value), `${ingredient.name}: ${value}`);
      assert.ok(!measurementNoticePattern.test(value), `${ingredient.name}: ${value}`);
    }
  }
});

test('legacy AI summaries, questions, changes and saved adaptation guidance all project while IDs and URLs stay intact', () => {
  const recipe = { ...structuredClone(catalog[0]), adaptation: { sourceRecipeId: catalog[0].id, request: 'Use 182 g coconut oil with 36 ml water.', createdAt: '2026-10-24', changes: ['Swap 227 grams butter.'], considerations: ['Do not heat above 80°C. This is an approximation.'], source: 'openai', model: 'test-model', before: structuredClone(catalog[0]) } };
  const raw = { recipe, summary: 'Use 182 g coconut oil and 36 mL water.', changes: ['Swap 227 g butter.'], considerations: ['Chill below 4°C.'], questions: ['Is the container 500 ml?'], source: 'openai', model: 'test-model' };
  const snapshot = structuredClone(raw);
  const display = toUsChefResult(raw);
  for (const [path, value] of visibleStrings(display)) {
    assert.ok(!metricUnitPattern.test(value), `${path}: ${value}`);
    assert.ok(!measurementNoticePattern.test(value), `${path}: ${value}`);
  }
  assert.deepEqual(raw, snapshot);
  assert.equal(display.model, raw.model);
  assert.equal(display.recipe.adaptation.sourceRecipeId, recipe.adaptation.sourceRecipeId);
  assert.deepEqual(display.recipe.sources.map(source => source.url), recipe.sources.map(source => source.url));
});

test('measurement recognition leaves unrelated words and identifiers alone', () => {
  const text = 'Programs for 2 large eggs use cream and regular sugar. Vitamin C is not a measurement.';
  assert.equal(toUsText(text), text);
  assert.equal(metricUnitPattern.test('programs and cream'), false);
  assert.equal(toUsRecipe(null), null);
  assert.equal(toUsChefResult(null), null);
});

test('fractional and leading-decimal metric quantities convert as complete numbers without leftover prefixes', () => {
  assert.equal(toUsText('Add 1/2 g gelatin.'), 'Add 0.179 tsp gelatin.');
  assert.equal(toUsText('Add .5 mL water.'), 'Add 0.1 tsp water.');
  assert.equal(toUsText('Add 1 1/2 g gelatin.'), 'Add 0.536 tsp gelatin.');
  assert.equal(toUsText('Add 1½ g gelatin.'), toUsText('Add 1 1/2 g gelatin.'));
  assert.equal(toUsText('Add 1 / 2 g gelatin.'), toUsText('Add 1/2 g gelatin.'));
  for (const recipe of catalog) {
    const once = toUsRecipe(recipe);
    assert.deepEqual(toUsRecipe(once), once, recipe.id + ' projection is idempotent');
  }
});
