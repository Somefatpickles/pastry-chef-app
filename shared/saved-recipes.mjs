import { batchConsiderations, parseAmount } from './recipe-core.mjs';

const text = value => typeof value === 'string' ? value.normalize('NFC').replace(/\s+/gu, ' ').trim() : '';
const generatedBatchNotes = new Set(batchConsiderations.map(text));
const unitNames = new Map([
  ['cup', 'cup'], ['cups', 'cup'],
  ['tsp', 'tsp'], ['teaspoon', 'tsp'], ['teaspoons', 'tsp'],
  ['tbsp', 'tbsp'], ['tablespoon', 'tbsp'], ['tablespoons', 'tbsp'],
  ['g', 'g'], ['gram', 'g'], ['grams', 'g'],
  ['kg', 'kg'], ['kilogram', 'kg'], ['kilograms', 'kg'],
  ['ml', 'ml'], ['mL', 'ml'], ['milliliter', 'ml'], ['milliliters', 'ml'], ['millilitre', 'ml'], ['millilitres', 'ml'],
  ['l', 'l'], ['L', 'l'], ['liter', 'l'], ['liters', 'l'], ['litre', 'l'], ['litres', 'l'],
  ['oz', 'oz'], ['ounce', 'oz'], ['ounces', 'oz'],
  ['fl oz', 'fl oz'], ['fluid ounce', 'fl oz'], ['fluid ounces', 'fl oz'],
  ['lb', 'lb'], ['lbs', 'lb'], ['pound', 'lb'], ['pounds', 'lb'],
]);

function amountKey(value) {
  const normalized = text(value);
  const parsed = parseAmount(normalized);
  // Keep full numeric precision and preserve unknown unit spellings. Converting
  // cups to weights or folding unknown abbreviations can merge different recipes.
  return parsed ? [parsed.quantity, unitNames.get(text(parsed.unit)) ?? text(parsed.unit)] : normalized;
}

function ingredientNote(value) {
  return text(value)
    .replace(/^Base-recipe note \(amounts here are unscaled\):\s*/, '')
    .replace(/(?:; )?Equipment allowance; keep the specified depth\/amount for each batch\.$/, '');
}

function contextList(values) {
  return (values ?? []).map(text).filter(value => value && !generatedBatchNotes.has(value));
}

function yieldKey(recipe) {
  const value = text(recipe.yield);
  const base = text(recipe.baseYield);
  // scaleRecipe can return to an original-size batch after scaling a saved copy.
  return base && value === `1 × original batch (${base})` ? base : value;
}

/** Identity of the recipe itself, independent of its saved name and provenance. */
export function recipeContentKey(recipe) {
  return JSON.stringify({
    ingredients: recipe.ingredients.map(ingredient => ({
      name: text(ingredient.name),
      amount: amountKey(ingredient.amount),
      note: ingredientNote(ingredient.note),
      scaleWithBatch: ingredient.scaleWithBatch !== false,
    })),
    steps: recipe.steps.map(step => ({
      title: text(step.title), detail: text(step.detail), why: text(step.why), tip: text(step.tip),
    })),
    equipment: (recipe.equipment ?? []).map(text).filter(Boolean),
    storage: text(recipe.storage),
    notes: contextList(recipe.notes),
    considerations: contextList(recipe.adaptation?.considerations),
    yield: yieldKey(recipe),
    time: text(recipe.time),
  });
}

export function sameRecipeContent(first, second) {
  return recipeContentKey(first) === recipeContentKey(second);
}

function assertFreshId(recipes, candidate) {
  if (recipes.some(recipe => recipe.id === candidate.id)) {
    throw new Error('A distinct saved recipe needs a new local recipe ID.');
  }
}

/**
 * Plan a save without mutating the collection or recipe. Existing duplicate
 * records are deliberately retained; preventing a new duplicate is lossless.
 * Callers provide a fresh candidate ID for a distinct new variant.
 */
export function planSavedRecipe({ recipes, candidate, selectedId, limit = 200 }) {
  const candidateKey = recipeContentKey(candidate);
  const selected = recipes.find(recipe => recipe.id === selectedId);
  const title = text(candidate.title);
  if (selected && recipeContentKey(selected) === candidateKey) {
    if (text(selected.title) === title) return { status: 'unchanged', recipes, recipe: selected };
    // Preserve the saved ID, metadata, method IDs, and every field except title.
    const renamed = { ...selected, title };
    return { status: 'renamed', recipes: recipes.map(recipe => recipe === selected ? renamed : recipe), recipe: renamed };
  }
  const duplicate = recipes.find(recipe => recipeContentKey(recipe) === candidateKey);
  if (duplicate) return { status: 'duplicate', recipes, recipe: duplicate };
  if (recipes.length >= limit) return { status: 'full', recipes, recipe: null };
  assertFreshId(recipes, candidate);
  const added = title === candidate.title ? candidate : { ...candidate, title };
  return { status: 'added', recipes: [...recipes, added], recipe: added };
}

/** Imports never rename a saved recipe. Capacity failures leave the set intact. */
export function planRecipeImport({ recipes, candidates, limit = 200 }) {
  const keys = new Set(recipes.map(recipeContentKey));
  const additions = [];
  let skipped = 0;
  for (const candidate of candidates) {
    const key = recipeContentKey(candidate);
    if (keys.has(key)) {
      skipped += 1;
      continue;
    }
    assertFreshId([...recipes, ...additions], candidate);
    keys.add(key);
    additions.push(candidate);
  }
  if (!additions.length) return { status: 'unchanged', recipes, added: 0, skipped, rejected: 0 };
  if (recipes.length + additions.length > limit) return { status: 'full', recipes, added: 0, skipped, rejected: additions.length };
  return { status: 'imported', recipes: [...recipes, ...additions], added: additions.length, skipped, rejected: 0 };
}
