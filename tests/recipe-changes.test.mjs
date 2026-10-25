import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecipeChanges } from '../shared/recipe-changes.mjs';

const original = {
  id: 'cake', title: 'Vanilla Cake', blurb: 'A tender cake.', time: '1 hour', yield: '8 slices', difficulty: 'Novice', category: 'Cakes',
  equipment: ['8-inch pan', 'Whisk'], notes: ['Use cool butter.'], storage: 'Keep covered for 2 days.',
  ingredients: [
    { id: 'flour', name: 'All-purpose flour', amount: '240 g' },
    { id: 'batter-butter', name: 'Unsalted butter', amount: '100 g', note: 'Softened; batter' },
    { id: 'frosting-butter', name: 'Unsalted butter', amount: '50 g', note: 'Softened; frosting' },
    { id: 'vanilla', name: 'Vanilla extract', amount: '1/2 tsp' },
  ],
  steps: [
    { id: 'mix', title: 'Mix the batter', detail: 'Mix the flour with the butter until all the dry flour has disappeared.', why: 'A gentle mix keeps the crumb tender.' },
    { id: 'bake', title: 'Bake the cake', detail: 'Bake at 350°F for 30 minutes until a skewer shows moist crumbs.', why: 'The center needs time to set.', tip: 'Check at 28 minutes.' },
  ],
};

test('no adaptation baseline leaves an ordinary library recipe unhighlighted', () => {
  const changes = getRecipeChanges(null, original);
  assert.equal(changes.changed, false);
  assert.ok(Object.values(changes.ingredients).every(item => !item.changed));
  assert.ok(Object.values(changes.steps).every(item => !item.changed));
});
test('an empty workspace supports nullable recipes without phantom removal highlights', () => {
  for (const before of [null, original]) {
    const changes = getRecipeChanges(before, null);
    assert.equal(changes.changed, false);
    assert.deepEqual(changes.ingredients, {});
    assert.deepEqual(changes.steps, {});
    assert.deepEqual(changes.removedIngredients, []);
    assert.deepEqual(changes.removedSteps, []);
  }
});
test('regenerated IDs, ingredient order, and equivalent fraction spelling do not create false changes', () => {
  const updated = structuredClone(original);
  updated.id = 'draft-cake';
  updated.ingredients.reverse();
  updated.ingredients.forEach((item, index) => { item.id = `adapt-ingredient-${index}`; });
  updated.steps.forEach((item, index) => { item.id = `adapt-step-${index}`; });
  updated.ingredients.find(item => item.name === 'Vanilla extract').amount = '0.5 teaspoon';
  updated.equipment.reverse();
  const changes = getRecipeChanges(original, updated);
  assert.equal(changes.changed, false);
  assert.ok(Object.values(changes.ingredients).every(item => !item.changed));
});
test('duplicate ingredient names stay aligned with their component when amounts cross', () => {
  const updated = structuredClone(original);
  updated.ingredients = [
    { id: 'new-frosting', name: 'Unsalted butter', amount: '100 g', note: 'Softened; frosting' },
    { id: 'new-batter', name: 'Unsalted butter', amount: '80 g', note: 'Softened; batter' },
    updated.ingredients[0], updated.ingredients[3],
  ];
  const changes = getRecipeChanges(original, updated);
  assert.equal(changes.ingredients['new-frosting'].previous.id, 'frosting-butter');
  assert.equal(changes.ingredients['new-batter'].previous.id, 'batter-butter');
  assert.equal(changes.ingredients['new-frosting'].fields.amount, true);
  assert.equal(changes.ingredients['new-frosting'].fields.note, false);
  assert.equal(changes.ingredients['new-batter'].fields.amount, true);
  assert.equal(changes.removedIngredients.length, 0);
});
test('a replacement exposes both the new ingredient and the removed original', () => {
  const updated = structuredClone(original);
  updated.ingredients[1] = { id: 'oil', name: 'Refined coconut oil', amount: '80 g', note: 'Soft-solid; batter' };
  const changes = getRecipeChanges(original, updated);
  assert.equal(changes.ingredients.oil.added, true);
  assert.equal(changes.ingredients.oil.changed, true);
  assert.deepEqual(changes.removedIngredients.map(item => item.id), ['batter-butter']);
  assert.equal(changes.ingredients['frosting-butter'].changed, false);
});
test('all displayed recipe-level fields and each changed method field are reported', () => {
  const updated = structuredClone(original);
  Object.assign(updated, { title: 'Dairy-Free Vanilla Cake', blurb: 'An adapted cake.', time: '90 minutes', yield: '10 slices', difficulty: 'Intermediate', category: 'My cakes', equipment: [...original.equipment, 'Cooling rack'], notes: ['Use a firm dairy-free block.'], storage: 'Refrigerate for 3 days.' });
  updated.ingredients[0].note = 'Spoon and level.';
  updated.steps[1] = { ...updated.steps[1], id: 'new-bake', detail: 'Bake at 350°F for 35 minutes until a skewer shows moist crumbs.', why: 'This wetter batter needs longer.', tip: 'Check at 32 minutes.' };
  const changes = getRecipeChanges(original, updated);
  assert.ok(Object.values(changes.fields).every(Boolean));
  assert.equal(changes.ingredients.flour.fields.note, true);
  assert.equal(changes.steps['new-bake'].fields.title, false);
  assert.equal(changes.steps['new-bake'].fields.detail, true);
  assert.equal(changes.steps['new-bake'].fields.why, true);
  assert.equal(changes.steps['new-bake'].fields.tip, true);
});
test('new steps do not falsely mark following unchanged actions as moved', () => {
  const updated = structuredClone(original);
  updated.steps.unshift({ id: 'chill', title: 'Chill the bowl', detail: 'Refrigerate the mixing bowl for 15 minutes.', why: 'The cold surface controls the fat temperature.' });
  const changes = getRecipeChanges(original, updated);
  assert.equal(changes.steps.chill.added, true);
  assert.equal(changes.steps.mix.changed, false);
  assert.equal(changes.steps.bake.changed, false);
});
test('changing the execution order highlights the moved steps without inventing text changes', () => {
  const updated = structuredClone(original);
  updated.steps.reverse();
  const changes = getRecipeChanges(original, updated);
  assert.equal(changes.steps.mix.moved, true);
  assert.equal(changes.steps.bake.moved, true);
  assert.equal(changes.steps.mix.changed, true);
  assert.ok(Object.values(changes.steps.mix.fields).every(value => value === false));
});
test('a renamed step with the same method preserves field-level comparison', () => {
  const updated = structuredClone(original);
  updated.steps[0].id = 'new-mix';
  updated.steps[0].title = 'Combine gently';
  const changes = getRecipeChanges(original, updated);
  assert.equal(changes.steps['new-mix'].added, false);
  assert.equal(changes.steps['new-mix'].fields.title, true);
  assert.equal(changes.steps['new-mix'].fields.detail, false);
  assert.equal(changes.removedSteps.length, 0);
});
test('removed steps remain available to show explicitly, and added notes alone count as a change', () => {
  const updated = structuredClone(original);
  updated.steps.pop();
  const changes = getRecipeChanges(original, updated);
  assert.deepEqual(changes.removedSteps.map(step => step.id), ['bake']);
  assert.equal(changes.changed, true);
  const notesOnly = structuredClone(original); notesOnly.notes.push('Use a cold tray.');
  assert.equal(getRecipeChanges(original, notesOnly).fields.notes, true);
});
test('comparison never mutates recipes and records arbitrary IDs without prototype surprises', () => {
  const before = structuredClone(original); const after = structuredClone(original);
  after.ingredients[0].id = '__proto__'; after.ingredients[0].amount = '300 g';
  const snapshots = [structuredClone(before), structuredClone(after)];
  const changes = getRecipeChanges(before, after);
  assert.equal(Object.hasOwn(changes.ingredients, '__proto__'), true);
  assert.equal(changes.ingredients.__proto__.fields.amount, true);
  assert.deepEqual([before, after], snapshots);
});
