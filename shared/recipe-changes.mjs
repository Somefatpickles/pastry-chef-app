import { parseAmount } from './recipe-core.mjs';

const recipeFields = ['title', 'blurb', 'time', 'yield', 'difficulty', 'category', 'equipment', 'notes', 'storage'];
const ingredientFields = ['name', 'amount', 'note', 'scaleWithBatch'];
const stepFields = ['title', 'detail', 'why', 'tip'];
const components = new Set(['batter', 'dough', 'filling', 'frosting', 'icing', 'shell', 'crust', 'glaze', 'coating', 'custard', 'wash', 'ganache', 'streusel', 'topping', 'lamination']);

// IDs are intentionally excluded. The chef regenerates positional IDs after
// every proposal, including when unchanged ingredients move to another index.
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const tokens = value => new Set(normalize(value).match(/[a-z0-9]+/g) ?? []);
const arraySignature = values => JSON.stringify((values ?? []).map(normalize).sort());

function amountSignature(value) {
  const parsed = parseAmount(value ?? '');
  if (!parsed) return normalize(value);
  const aliases = { grams: 'g', gram: 'g', milliliters: 'ml', milliliter: 'ml', millilitres: 'ml', millilitre: 'ml', teaspoons: 'tsp', teaspoon: 'tsp', tablespoons: 'tbsp', tablespoon: 'tbsp', cups: 'cup', ounces: 'oz', ounce: 'oz', pounds: 'lb', pound: 'lb' };
  const unit = normalize(parsed.unit);
  return `${parsed.quantity}:${aliases[unit] ?? unit}`;
}

function fieldValue(item, field) {
  if (field === 'amount') return amountSignature(item[field]);
  if (field === 'scaleWithBatch') return item[field] !== false;
  return normalize(item[field]);
}

function signature(item, fields) { return JSON.stringify(fields.map(field => fieldValue(item, field))); }
function similarity(left, right) {
  const a = tokens(left); const b = tokens(right);
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const value of a) if (b.has(value)) common++;
  return common / (a.size + b.size - common);
}

function ingredientScore(before, after, oldIndex, newIndex) {
  const beforeTokens = tokens(before.note); const afterTokens = tokens(after.note);
  const oldComponent = [...beforeTokens].filter(token => components.has(token));
  const newComponent = [...afterTokens].filter(token => components.has(token));
  const sharedComponent = oldComponent.some(token => newComponent.includes(token));
  const conflictingComponents = oldComponent.length && newComponent.length && !sharedComponent;
  // Keep identical-name butter/sugar entries associated with their component,
  // even when one amount changes to equal another component's old amount.
  return (sharedComponent ? 100 : 0) - (conflictingComponents ? 100 : 0)
    + similarity(before.note, after.note) * 20
    + (amountSignature(before.amount) === amountSignature(after.amount) ? 8 : 0)
    - Math.abs(oldIndex - newIndex) * .001;
}

function align(before, after, fields, key, kind) {
  const matches = new Map(); const used = new Set();
  // Match unchanged content first, irrespective of position. This protects
  // duplicate names and prevents an insertion from recoloring a whole list.
  for (let next = 0; next < after.length; next++) {
    const exact = signature(after[next], fields);
    const previous = before.findIndex((item, index) => !used.has(index) && signature(item, fields) === exact);
    if (previous >= 0) { matches.set(next, previous); used.add(previous); }
  }
  const candidates = [];
  for (let next = 0; next < after.length; next++) {
    if (matches.has(next)) continue;
    for (let previous = 0; previous < before.length; previous++) {
      if (used.has(previous) || normalize(before[previous][key]) !== normalize(after[next][key])) continue;
      const score = kind === 'ingredients'
        ? ingredientScore(before[previous], after[next], previous, next)
        : similarity(before[previous].detail, after[next].detail) * 20 - Math.abs(previous - next) * .001;
      candidates.push({ previous, next, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.previous - b.previous || a.next - b.next);
  for (const { previous, next } of candidates) {
    if (matches.has(next) || used.has(previous)) continue;
    matches.set(next, previous); used.add(previous);
  }
  // A step title can be rewritten without changing the rest of its action.
  // Require substantial detail overlap before treating it as the same step.
  if (kind === 'steps') {
    const related = [];
    for (let next = 0; next < after.length; next++) {
      if (matches.has(next)) continue;
      for (let previous = 0; previous < before.length; previous++) {
        if (used.has(previous)) continue;
        const score = similarity(before[previous].detail, after[next].detail);
        if (score >= .65) related.push({ previous, next, score });
      }
    }
    related.sort((a, b) => b.score - a.score || a.previous - b.previous || a.next - b.next);
    for (const { previous, next } of related) {
      if (matches.has(next) || used.has(previous)) continue;
      matches.set(next, previous); used.add(previous);
    }
  }
  const moved = new Set();
  if (kind === 'steps') {
    const pairs = [...matches.entries()].sort((a, b) => a[0] - b[0]);
    for (let left = 0; left < pairs.length; left++) for (let right = left + 1; right < pairs.length; right++) {
      if (pairs[left][1] > pairs[right][1]) { moved.add(pairs[left][0]); moved.add(pairs[right][0]); }
    }
  }
  const entries = after.map((item, index) => {
    const previousIndex = matches.get(index);
    const previous = previousIndex === undefined ? undefined : before[previousIndex];
    const changes = Object.fromEntries(fields.map(field => [field, previous ? fieldValue(previous, field) !== fieldValue(item, field) : true]));
    return [item.id, {
      changed: !previous || moved.has(index) || Object.values(changes).some(Boolean),
      added: !previous,
      ...(kind === 'steps' ? { moved: moved.has(index) } : {}),
      fields: changes,
      ...(previous ? { previous } : {}),
    }];
  });
  return { items: Object.fromEntries(entries), removed: before.filter((_, index) => !used.has(index)) };
}

/** Compare the user's original working recipe with the applied proposal. */
export function getRecipeChanges(before, after) {
  if (!after) return {
    changed: false,
    fields: Object.fromEntries(recipeFields.map(field => [field, false])),
    ingredients: {}, steps: {}, removedIngredients: [], removedSteps: [],
  };
  const fields = Object.fromEntries(recipeFields.map(field => [field, Boolean(before) && (
    field === 'equipment' || field === 'notes'
      ? arraySignature(before[field]) !== arraySignature(after[field])
      : normalize(before[field]) !== normalize(after[field])
  )]));
  if (!before) return {
    changed: false, fields,
    ingredients: Object.fromEntries(after.ingredients.map(item => [item.id, { changed: false, added: false, fields: Object.fromEntries(ingredientFields.map(field => [field, false])) }])),
    steps: Object.fromEntries(after.steps.map(item => [item.id, { changed: false, added: false, moved: false, fields: Object.fromEntries(stepFields.map(field => [field, false])) }])),
    removedIngredients: [], removedSteps: [],
  };
  const ingredients = align(before.ingredients, after.ingredients, ingredientFields, 'name', 'ingredients');
  const steps = align(before.steps, after.steps, stepFields, 'title', 'steps');
  return {
    changed: Object.values(fields).some(Boolean) || ingredients.removed.length > 0 || steps.removed.length > 0
      || Object.values(ingredients.items).some(item => item.changed) || Object.values(steps.items).some(item => item.changed),
    fields, ingredients: ingredients.items, steps: steps.items,
    removedIngredients: ingredients.removed, removedSteps: steps.removed,
  };
}
