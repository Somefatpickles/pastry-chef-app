import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { displayIngredientAmount, formatKitchenVolume } from '../shared/baking-measures.mjs';
import { scaleRecipe } from '../shared/recipe-core.mjs';

const catalog = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
const ingredient = (name, amount, note) => ({ id: 'measure-example', name, amount, ...(note ? { note } : {}) });
test('independent published cup weights give familiar measures for different ingredients', () => {
  for (const [name, amount, expected] of [
    ['All-purpose flour', '120 g', '1 cup'], ['Bread flour', '240 g', '2 cups'],
    ['Granulated sugar', '198 g', '1 cup'], ['Light brown sugar', '213 g', '1 cup'],
    ['Powdered sugar', '113 g', '1 cup'], ['Almond flour', '96 g', '1 cup'],
    ['Unsalted butter', '113 g', '1/2 cup'], ['Cornstarch', '28 g', '1/4 cup'],
    ['Unsweetened cocoa', '84 g', '1 cup'], ['Whole milk', '240 ml', '1 cup'],
    ['Heavy cream', '120 ml', '1/2 cup'], ['Water', '15 ml', '1 tbsp'],
    ['Instant yeast', '7 g', '2 1/4 tsp'], ['Unflavored powdered gelatin', '7 g', '2 1/2 tsp'],
    ['Fine salt', '6 g', '1 tsp'], ['Neutral vegetable oil', '14 g', '1 tbsp'],
    ['Old-fashioned rolled oats', '89 g', '1 cup'], ['Semisweet chocolate chips', '170 g', '1 cup'],
    ['Freshly finely grated carrots', '99 g', '1 cup'], ['Very ripe peeled bananas', '227 g', '1 cup'],
    ['Pitted cherries', '160 g', '1 cup'], ['Peeled, cored apples', '113 g', '1 cup'],
    ['Blueberries', '155 g', '1 cup'], ['Refined coconut oil', '113 g', '1/2 cup'],
  ]) assert.equal(displayIngredientAmount(ingredient(name, amount)).amount, expected, name);
});
test('remainder teaspoons preserve quantities that are not a convenient cup fraction', () => {
  assert.equal(displayIngredientAmount(ingredient('All-purpose flour', '125 g')).amount, '1 cup + 2 tsp');
  assert.equal(displayIngredientAmount(ingredient('Water', '500 ml')).amount, '2 cups + 1 tbsp + 1 tsp');
  assert.equal(formatKitchenVolume(.125), '1/8 tsp');
  assert.equal(formatKitchenVolume(.025), '0.025 tsp');
  assert.equal(formatKitchenVolume(15 / 112 * 48), '2 tbsp + 3/8 tsp');
});
test('the entire original and scaled library uses household units without mutating formulas', () => {
  let count = 0;
  for (const recipe of catalog) {
    const before = structuredClone(recipe);
    for (const factor of [1, .5, 2.5]) {
      const current = scaleRecipe(recipe, factor);
      for (const item of current.ingredients) {
        const displayed = displayIngredientAmount(item);
        assert.ok(displayed.amount, `${recipe.id}: ${item.name}`);
        assert.ok(!/\b(?:g|grams?|kg|kilograms?|ml|millilit(?:er|re)s?|lit(?:er|re)s?)\b/i.test(displayed.amount), `${recipe.id}: ${item.name}: ${displayed.amount}`);
        assert.ok(!/NaN|Infinity/.test(displayed.amount));
        assert.equal(typeof displayed.approximate, 'boolean');
        count++;
      }
    }
    assert.deepEqual(recipe, before, recipe.id);
  }
  assert.equal(catalog.length, 68);
  assert.equal(count, 694 * 3);
});
test('scaled familiar amounts are derived from exact canonical quantities', () => {
  const original = { ...catalog[0], ingredients: [ingredient('All-purpose flour', '120 g'), ingredient('Unsalted butter', '113 g'), ingredient('Whole milk', '240 ml')] };
  const scaled = scaleRecipe(original, 2.5);
  assert.deepEqual(scaled.ingredients.map(i => displayIngredientAmount(i).amount), ['2 1/2 cups', '1 1/4 cups', '2 1/2 cups']);
  assert.deepEqual(original.ingredients.map(i => i.amount), ['120 g', '113 g', '240 ml']);
});
test('counts, packaged solids and unknown AI ingredients remain meaningful without invented cup densities', () => {
  assert.equal(displayIngredientAmount(ingredient('Large eggs', '2.5')).amount, '2 1/2');
  assert.equal(displayIngredientAmount(ingredient('Large eggs', '2.99')).amount, '2.99');
  assert.equal(displayIngredientAmount(ingredient('Egg whites', '75 g')).amount, '2 1/2 large egg whites');
  assert.equal(displayIngredientAmount(ingredient('Cream cheese', '227 g')).amount, '8 oz');
  assert.equal(displayIngredientAmount(ingredient('Puff pastry', '500 g')).amount, '17 5/8 oz');
  const unknown = displayIngredientAmount(ingredient('An unresearched specialty ingredient', '100 g'));
  assert.match(unknown.amount, /oz$/); assert.equal(unknown.note, 'Measure ounces by weight.');
  const mixed = displayIngredientAmount(ingredient('Dried fruit or chocolate chips', '75 g'));
  assert.match(mixed.amount, /oz$/);
  assert.equal(displayIngredientAmount(ingredient('Vanilla ice cream', '1.5 litres')).amount, '6 1/4 cups');
});
test('precision-sensitive and packing-dependent measurements keep useful context', () => {
  assert.match(displayIngredientAmount(ingredient('Almond flour', '100 g')).note, /Spoon fine almond flour/);
  assert.match(displayIngredientAmount(ingredient('Unsalted butter', '250 g', 'Lamination block')).note, /butter-wrapper markings/);
  assert.match(displayIngredientAmount(ingredient('Light brown sugar', '213 g')).note, /Pack brown sugar/);
  assert.match(displayIngredientAmount(ingredient('Pitted cherries', '400 g')).note, /Remove pits, then chop/);
});
test('ingredient role matching does not assign butter, milk or fresh-egg densities to different products', () => {
  for (const name of ['Almond butter', 'Cashew butter', 'Coconut butter', 'Cocoa butter', 'Milk chocolate', 'Whole milk chocolate', 'Egg white powder', 'Applesauce']) {
    assert.match(displayIngredientAmount(ingredient(name, '100 g')).amount, /oz$/, name);
  }
  assert.equal(displayIngredientAmount(ingredient('Cold unsalted butter', '113 g')).amount, '1/2 cup');
  assert.equal(displayIngredientAmount(ingredient('Refined coconut oil', '113 g')).amount, '1/2 cup');
  assert.equal(displayIngredientAmount(ingredient('Dairy-free baking block (80% fat)', '113 g')).amount, '1/2 cup');
  assert.equal(displayIngredientAmount(ingredient('Dairy-free butter', '113 g')).amount, '1/2 cup');
  assert.equal(displayIngredientAmount(ingredient('Egg white', '30 g')).amount, '1 large egg white');
  assert.equal(displayIngredientAmount(ingredient('Large egg yolk', '18 g')).amount, '1 large egg yolk');
});
