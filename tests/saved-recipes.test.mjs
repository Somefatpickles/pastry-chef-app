import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { recipeContentKey, sameRecipeContent, planSavedRecipe, planRecipeImport } from '../shared/saved-recipes.mjs';
import { scaleRecipe } from '../shared/recipe-core.mjs';

const catalog = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url), 'utf8'));
const fixture = catalog.find(recipe => recipe.id === 'classic-chocolate-chip-cookies');
const local = (id = 'local-cookies', title = 'Weekend cookies') => ({ ...structuredClone(fixture), id, title });

test('every catalog recipe remains distinct by its actual recipe content', () => {
  assert.equal(new Set(catalog.map(recipeContentKey)).size, catalog.length);
});

test('saved identity ignores names, IDs and review/adaptation bookkeeping', () => {
  const original = local();
  const copy = local('another-id', 'Another name');
  copy.ingredients.forEach((ingredient, index) => { ingredient.id = `new-ingredient-${index}`; });
  copy.steps.forEach((step, index) => { step.id = `new-step-${index}`; });
  copy.blurb = 'A new description';
  copy.category = 'Personal favorites';
  copy.difficulty = 'Experienced';
  copy.reviewedOn = '2099-01-01';
  copy.reviewNotes = ['Different review history'];
  copy.sourceRecipeId = 'old-source';
  copy.baseYield = 'Old bookkeeping yield';
  copy.batchScale = 3;
  copy.adaptation = { sourceRecipeId: 'old-source', createdAt: '2099-01-01', request: 'Rename this', changes: ['Reworded title'], considerations: [], source: 'local', model: 'other-model', before: structuredClone(fixture) };
  assert.equal(sameRecipeContent(original, copy), true);
  const result = planSavedRecipe({ recipes: [original], candidate: copy });
  assert.equal(result.status, 'duplicate');
  assert.equal(result.recipe, original);
  assert.equal(result.recipes[0].title, 'Weekend cookies');
});

test('a selected saved recipe is renamed in place while retaining every other field', () => {
  const original = local();
  original.adaptation = { sourceRecipeId: fixture.id, request: 'My request', createdAt: '2026-10-24', changes: ['Original change'], considerations: ['Use a cool baking sheet.'], source: 'local' };
  const candidate = { ...structuredClone(original), id: 'new-save-id', title: '  Family   favorites  ' };
  candidate.adaptation.createdAt = '2099-01-01';
  candidate.ingredients[0].id = 'ignored-new-ingredient-id';
  const recipes = [original];
  const before = structuredClone(recipes);
  const result = planSavedRecipe({ recipes, candidate, selectedId: original.id });
  assert.equal(result.status, 'renamed');
  assert.equal(result.recipes.length, 1);
  assert.deepEqual(result.recipe, { ...original, title: 'Family favorites' });
  assert.deepEqual(recipes, before);
  assert.equal(result.recipe.id, original.id);
  const progress = { [original.id]: { ingredients: { [original.ingredients[0].id]: true }, steps: {}, completedAt: '2026-10-24' } };
  assert.equal(progress[result.recipe.id].ingredients[result.recipe.ingredients[0].id], true);
  assert.equal(planSavedRecipe({ recipes: result.recipes, candidate: result.recipe, selectedId: original.id }).status, 'unchanged');
});

test('quantity and method changes save distinct variants without overwriting their source', () => {
  const original = local();
  const variants = [structuredClone(original), structuredClone(original)];
  variants[0].ingredients[0].amount = '300 g';
  variants[1].steps[0].detail += ' Rest for another 10 minutes.';
  variants.forEach((candidate, index) => {
    candidate.id = `variant-${index}`;
    const result = planSavedRecipe({ recipes: [original], candidate, selectedId: original.id });
    assert.equal(result.status, 'added');
    assert.equal(result.recipes[0], original);
    assert.equal(result.recipes[1], candidate);
  });
});

test('notes, equipment, scaling semantics and meaningful adaptation context remain distinct', () => {
  const original = local();
  const changes = [
    recipe => { recipe.ingredients[0].note = 'Sift before measuring.'; },
    recipe => { recipe.ingredients[0].scaleWithBatch = false; },
    recipe => { recipe.steps[0].tip = 'Use an oven thermometer.'; },
    recipe => { recipe.equipment = [...recipe.equipment, 'Thermometer']; },
    recipe => { recipe.storage += ' Freeze the portioned dough.'; },
    recipe => { recipe.notes.push('Do not serve to anyone with an egg allergy.'); },
    recipe => { recipe.yield = '24 cookies'; },
    recipe => { recipe.time = '2 hours'; },
    recipe => { recipe.adaptation = { considerations: ['Check chocolate labels for milk allergens.'] }; },
  ];
  for (const change of changes) {
    const candidate = structuredClone(original);
    change(candidate);
    assert.equal(sameRecipeContent(original, candidate), false);
  }
});

test('empty optional fields, default scaling and whitespace do not create duplicates', () => {
  const original = local();
  const candidate = structuredClone(original);
  candidate.ingredients[0].name = `  ${candidate.ingredients[0].name.replaceAll(' ', ' \n ')} `;
  candidate.ingredients[0].amount = '285.0 grams';
  candidate.ingredients[0].note = '  ';
  candidate.ingredients[0].scaleWithBatch = true;
  candidate.steps[0].tip = '';
  candidate.notes.push('  ');
  assert.equal(sameRecipeContent(original, candidate), true);
  const halfCup = { ...structuredClone(original), ingredients: [{ id: 'a', name: 'Flour', amount: '½ cup' }] };
  const decimalCup = { ...structuredClone(halfCup), ingredients: [{ id: 'b', name: 'Flour', amount: '0.5 cups', note: '', scaleWithBatch: true }] };
  assert.equal(sameRecipeContent(halfCup, decimalCup), true);
  decimalCup.ingredients[0].amount = '0.5000000001 cup';
  assert.equal(sameRecipeContent(halfCup, decimalCup), false);
  decimalCup.ingredients[0].amount = '1 T';
  halfCup.ingredients[0].amount = '1 t';
  assert.equal(sameRecipeContent(halfCup, decimalCup), false);
});

test('scaled real recipes deduplicate on displayed ingredient content rather than bookkeeping', () => {
  const original = local();
  const saved = { ...scaleRecipe(original, 2.5), id: 'scaled-local' };
  const repeated = { ...scaleRecipe(original, 2.5), id: 'resave', title: 'A different title', batchScale: 99, baseYield: 'Different metadata' };
  assert.equal(planSavedRecipe({ recipes: [saved], candidate: repeated }).status, 'duplicate');
  assert.equal(planSavedRecipe({ recipes: [original], candidate: saved }).status, 'added');
  const restored = scaleRecipe(saved, 0.4);
  assert.equal(sameRecipeContent(original, restored), true);
});

test('changing a selected variant to match another saved recipe preserves both originals', () => {
  const original = local();
  const variant = { ...scaleRecipe(original, 2), id: 'double-batch', title: 'Double batch' };
  const recipes = [original, variant];
  const candidate = { ...structuredClone(variant), id: 'new-candidate', title: 'Renamed original' };
  const result = planSavedRecipe({ recipes, candidate, selectedId: original.id });
  assert.equal(result.status, 'duplicate');
  assert.equal(result.recipe, variant);
  assert.equal(result.recipes, recipes);
  assert.deepEqual(result.recipes.map(recipe => recipe.title), ['Weekend cookies', 'Double batch']);
});

test('capacity does not block duplicate detection or a selected recipe rename', () => {
  const original = local();
  const recipes = [original];
  const candidate = { ...local('new-id'), title: 'Renamed cookies' };
  assert.equal(planSavedRecipe({ recipes, candidate, selectedId: original.id, limit: 1 }).status, 'renamed');
  assert.equal(planSavedRecipe({ recipes, candidate, limit: 1 }).status, 'duplicate');
  const distinct = { ...scaleRecipe(original, 2), id: 'new-id' };
  assert.equal(planSavedRecipe({ recipes, candidate: distinct, limit: 1 }).status, 'full');
});

test('legacy duplicates are retained while new saves and imports cannot add more copies', () => {
  const first = local();
  const second = local('legacy-duplicate', 'Legacy name');
  const recipes = [first, second];
  const candidate = local('new-id', 'New name');
  const save = planSavedRecipe({ recipes, candidate });
  assert.equal(save.status, 'duplicate');
  assert.equal(save.recipes, recipes);
  const rename = planSavedRecipe({ recipes, candidate, selectedId: second.id });
  assert.equal(rename.status, 'renamed');
  assert.equal(rename.recipes.length, 2);
  assert.equal(rename.recipes[0], first);
  assert.equal(rename.recipe.id, second.id);
});

test('imports skip duplicates internally and against existing recipes without renaming', () => {
  const original = local();
  const variant = { ...scaleRecipe(original, 2), id: 'double' };
  const candidates = [local('duplicate', 'An imported name'), variant, { ...structuredClone(variant), id: 'duplicate-double', title: 'Second double' }];
  const before = structuredClone(candidates);
  const result = planRecipeImport({ recipes: [original], candidates });
  assert.equal(result.status, 'imported');
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 2);
  assert.equal(result.recipes[0], original);
  assert.equal(result.recipes[1], variant);
  assert.equal(result.recipes[0].title, 'Weekend cookies');
  assert.deepEqual(candidates, before);
});

test('imports apply their unique additions atomically and allow duplicate-only imports at capacity', () => {
  const original = local();
  const recipes = [original];
  const candidates = [local('duplicate'), { ...scaleRecipe(original, 2), id: 'double' }, { ...scaleRecipe(original, 3), id: 'triple' }];
  const result = planRecipeImport({ recipes, candidates, limit: 2 });
  assert.equal(result.status, 'full');
  assert.equal(result.added, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.rejected, 2);
  assert.equal(result.recipes, recipes);
  const duplicateOnly = planRecipeImport({ recipes, candidates: [local('duplicate')], limit: 1 });
  assert.equal(duplicateOnly.status, 'unchanged');
  assert.equal(duplicateOnly.skipped, 1);
});

test('distinct additions require fresh IDs to protect recipe progress references', () => {
  const original = local();
  const candidate = scaleRecipe(original, 2);
  assert.throws(() => planSavedRecipe({ recipes: [original], candidate }), /new local recipe ID/);
  assert.throws(() => planRecipeImport({ recipes: [original], candidates: [candidate] }), /new local recipe ID/);
});
