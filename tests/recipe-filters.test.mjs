import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { availableCategories, normalizeCategory, matchesRecipeFilters } from '../shared/recipe-filters.mjs';
const recipes = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
test('each level exposes exactly categories represented by its recipes', () => {
  for (const level of ['Novice', 'Intermediate', 'Experienced', 'Challenges']) {
    const categories = availableCategories(recipes, level);
    assert.ok(categories.every(category => recipes.some(recipe => recipe.difficulty === level && recipe.category === category)));
    assert.deepEqual(new Set(categories), new Set(recipes.filter(recipe => recipe.difficulty === level && recipe.category).map(recipe => recipe.category)));
  }
  assert.deepEqual(availableCategories(recipes, 'Challenges'), []);
  assert.equal(recipes.filter(recipe => recipe.difficulty === 'Challenges').length, 10);
});
test('changing skill level resets an unavailable category and preserves an available one', () => {
  assert.equal(normalizeCategory(recipes, 'Experienced', 'Cookies'), 'All categories');
  assert.equal(normalizeCategory(recipes, 'Novice', 'Cookies'), 'Cookies');
  assert.equal(normalizeCategory(recipes, 'Challenges', 'Tarts'), 'All categories');
  assert.equal(normalizeCategory(recipes, 'All levels', 'Tarts'), 'Tarts');
});
test('saved collection filtering only uses categories belonging to saved recipes at the selected level', () => {
  const saved = [recipes.find(recipe => recipe.category === 'Cookies'), recipes.find(recipe => recipe.category === 'Tarts')];
  assert.deepEqual(availableCategories([], 'Novice'), []);
  assert.deepEqual(availableCategories(saved, 'Novice'), ['Cookies']);
  assert.equal(normalizeCategory(saved, 'Experienced', 'Cookies'), 'All categories');
});

test('completion and favorites filters combine without relying on checklist ticks', () => {
  const recipe = recipes[0];
  assert.equal(matchesRecipeFilters(recipe, { status: 'Completed', completed: false }), false);
  assert.equal(matchesRecipeFilters(recipe, { status: 'Completed', completed: true }), true);
  assert.equal(matchesRecipeFilters(recipe, { status: 'Not Completed', completed: true }), false);
  assert.equal(matchesRecipeFilters(recipe, { status: 'Not Completed', completed: false }), true);
  assert.equal(matchesRecipeFilters(recipe, { favorites: 'Favorites Only', favorite: false }), false);
  assert.equal(matchesRecipeFilters(recipe, { status: 'Completed', favorites: 'Favorites Only', completed: true, favorite: true }), true);
  assert.equal(matchesRecipeFilters(recipe, { status: 'Not Completed', favorites: 'Favorites Only', completed: false, favorite: true }), true);
  assert.equal(matchesRecipeFilters(recipe, { status: 'All', favorites: 'All' }), true);
});

test('status and favorites respect search, category, difficulty and saved recipe identity', () => {
  const recipe = recipes.find(item => item.category === 'Cookies');
  const filters = { category: recipe.category, difficulty: recipe.difficulty, search: ` ${recipe.title.toUpperCase()} `, status: 'Completed', favorites: 'Favorites Only', completed: true, favorite: true };
  assert.equal(matchesRecipeFilters(recipe, filters), true);
  assert.equal(matchesRecipeFilters(recipe, { ...filters, category: 'Custom' }), false);
  assert.equal(matchesRecipeFilters(recipe, { ...filters, difficulty: 'Challenges' }), false);
  assert.equal(matchesRecipeFilters(recipe, { ...filters, search: 'no-such-bake-ingredient' }), false);
  assert.equal(matchesRecipeFilters({ ...recipe, id: 'local-copy' }, { ...filters, favorite: false }), false);
});
