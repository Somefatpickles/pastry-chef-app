import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSavedRecipes, persistSavedRecipes, loadLocalProgress, persistLocalProgress, savedRecipesKey } from '../src/localStore.ts';
import { getRecipeChanges } from '../shared/recipe-changes.mjs';
import { isRecipe, scaleRecipe } from '../shared/recipe-core.mjs';
const recipes = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
test('saved adapted recipes survive a full serialization and reload', () => {
  const saved = { ...recipes[0], id: 'local-example', sourceRecipeId: recipes[0].id };
  persistSavedRecipes([saved]); assert.deepEqual(loadSavedRecipes(), [saved]);
});
test('corrupted recipe storage recovers without a crash', () => {
  values.set(savedRecipesKey, '{broken'); assert.deepEqual(loadSavedRecipes(), []);
  values.set(savedRecipesKey, JSON.stringify([null, { id: 'bad' }])); assert.deepEqual(loadSavedRecipes(), []);
});
test('AI comparison baseline and blue change flags survive saving, reload and batch scaling', () => {
  const before = structuredClone(recipes[0]);
  const edited = { ...structuredClone(before), id: 'local-ai', title: 'My adapted cake', ingredients: before.ingredients.map((i, n) => ({ ...i, amount: n === 0 ? '300 g' : i.amount })), adaptation: { sourceRecipeId: before.id, request: 'Adjust this cake', source: 'openai', createdAt: '2026-10-24T12:00:00.000Z', changes: ['Adjusted the flour.'], considerations: ['Check the batter.'], before, model: 'test-model' } };
  persistSavedRecipes([edited]);
  const reloaded = loadSavedRecipes()[0];
  assert.deepEqual(reloaded.adaptation.before, before);
  assert.equal(getRecipeChanges(reloaded.adaptation.before, reloaded).fields.title, true);
  assert.equal(getRecipeChanges(reloaded.adaptation.before, reloaded).ingredients[before.ingredients[0].id].fields.amount, true);
  const scaled = scaleRecipe(reloaded, 2.5);
  persistSavedRecipes([scaled]);
  assert.deepEqual(loadSavedRecipes()[0].adaptation.before, before);
  assert.equal(loadSavedRecipes()[0].adaptation.model, 'test-model');
});
test('invalid and recursively nested comparison baselines are rejected while legacy adaptations still load', () => {
  const adaptation = { sourceRecipeId: recipes[0].id, request: 'An older saved adaptation', source: 'openai', createdAt: '2026-10-24', changes: [], considerations: [] };
  assert.ok(isRecipe({ ...recipes[0], adaptation }));
  assert.equal(isRecipe({ ...recipes[0], adaptation: { ...adaptation, before: { id: 'broken' } } }), false);
  assert.equal(isRecipe({ ...recipes[0], adaptation: { ...adaptation, before: { ...recipes[0], adaptation } } }), false);
});
test('local progress persists and excludes malformed checklists or dates', () => {
  const progress = { sample: { ingredients: { flour: true }, steps: { mix: false }, completedAt: '2026-10-24T12:00:00.000Z' } };
  persistLocalProgress(progress); assert.deepEqual(loadLocalProgress(), progress);
  persistLocalProgress({ bad: { ingredients: null, steps: null }, date: { ingredients: {}, steps: {}, completedAt: 'not a date' } }); assert.deepEqual(loadLocalProgress(), {});
});
