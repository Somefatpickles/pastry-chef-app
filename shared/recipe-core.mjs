const fractionValues = { "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };

export function parseAmount(amount) {
  const normalized = String(amount).trim().replace(/\b\d{1,3}(?:,\d{3})+(?=\s|$)/g, x => x.replaceAll(',', '')).replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g, '$1 $2').replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, x => String(fractionValues[x]));
  const match = normalized.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+|\s+0\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  let quantity = 0;
  for (const part of match[1].split(/\s+/)) {
    const [a, b] = part.split('/').map(Number);
    quantity += b === undefined ? a : a / b;
  }
  if (!Number.isFinite(quantity) || quantity < 0 || /^[-–—/,]/.test(match[2]) || /\d/.test(match[2])) return null;
  return { quantity, unit: match[2] };
}

export function formatQuantity(number) {
  return Number(number.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3, useGrouping: false });
}

export const batchConsiderations = [
  'Repeat the method in original-size batches with the stated portion sizes and pan depth. Use extra pans for a larger batch. For a fractional cake batch, ask the chef for a smaller pan with comparable batter depth. Oven temperature stays the same and baking time does not multiply.',
  'For a fraction of an egg, beat it first, then weigh the fraction (one large egg without its shell is about 50 g; a white 30 g; a yolk 18 g).',
  'Ingredient notes may describe the original batch. Weigh the displayed scaled amounts. Rising, chilling and baking still depend on the stated visual and temperature cues.',
];

export function scaleRecipe(recipe, factor) {
  if (!Number.isFinite(factor) || factor < .1 || factor > 10) throw new Error('Choose a batch multiplier from 0.1 to 10.');
  if (factor === 1) return structuredClone(recipe);
  return {
    ...structuredClone(recipe),
    baseYield: recipe.baseYield ?? recipe.yield,
    batchScale: (recipe.batchScale ?? 1) * factor,
    yield: `${formatQuantity((recipe.batchScale ?? 1) * factor)} × original batch (${recipe.baseYield ?? recipe.yield})`,
    ingredients: recipe.ingredients.map(ingredient => {
      if (ingredient.scaleWithBatch === false) return { ...ingredient, note: `${ingredient.note?.replace(/; Equipment allowance; keep the specified depth\/amount for each batch\./g, '') ?? ''}; Equipment allowance; keep the specified depth/amount for each batch.`.replace(/^; /, '') };
      const parsed = parseAmount(ingredient.amount);
      const note = ingredient.note && /\d|[¼½¾⅓⅔⅛⅜⅝⅞]/.test(ingredient.note) && !ingredient.note.startsWith('Base-recipe note') ? `Base-recipe note (amounts here are unscaled): ${ingredient.note}` : ingredient.note;
      return parsed ? { ...ingredient, ...(note ? { note } : {}), amount: `${formatQuantity(parsed.quantity * factor)}${parsed.unit ? ` ${parsed.unit}` : ''}` } : { ...ingredient, note: `${ingredient.note ? ingredient.note + '; ' : ''}Not scaled automatically; adjust to the batch.` };
    }),
    notes: [...new Set([...(recipe.notes ?? []), ...batchConsiderations])],
  };
}

export function isRecipe(value) {
  const text = (v, max = 12000) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const optionalText = (v, max = 12000) => v === undefined || (typeof v === 'string' && v.length <= max);
  const optionalList = v => v === undefined || (Array.isArray(v) && v.length <= 100 && v.every(x => text(x)));
  const baseline = value?.adaptation?.before;
  const validBaseline = baseline === undefined || (baseline && typeof baseline === 'object' && baseline.adaptation === undefined && isRecipe(baseline));
  return !!value && typeof value === 'object' && text(value.id, 160) && text(value.title, 240)
    && text(value.blurb, 2000) && text(value.yield, 300) && text(value.time, 400)
    && ['Novice', 'Intermediate', 'Experienced', 'Challenges'].includes(value.difficulty)
    && Array.isArray(value.ingredients) && value.ingredients.length > 0 && value.ingredients.length <= 100
    && value.ingredients.every(i => i && text(i.id, 160) && text(i.name, 400) && text(i.amount, 200) && optionalText(i.note) && (i.scaleWithBatch === undefined || typeof i.scaleWithBatch === 'boolean'))
    && new Set(value.ingredients.map(i => i.id)).size === value.ingredients.length
    && Array.isArray(value.steps) && value.steps.length > 0 && value.steps.length <= 60
    && value.steps.every(s => s && text(s.id, 160) && text(s.title, 400) && text(s.detail) && optionalText(s.why) && optionalText(s.tip))
    && new Set(value.steps.map(s => s.id)).size === value.steps.length
    && (value.category == null || optionalText(value.category, 200)) && optionalText(value.storage) && optionalText(value.reviewedOn, 100) && optionalText(value.sourceRecipeId, 160) && optionalText(value.baseYield, 300)
    && (value.batchScale === undefined || (typeof value.batchScale === 'number' && Number.isFinite(value.batchScale) && value.batchScale > 0))
    && optionalList(value.equipment) && optionalList(value.notes) && optionalList(value.reviewNotes)
    && (value.sources === undefined || (Array.isArray(value.sources) && value.sources.length <= 30 && value.sources.every(s => s && text(s.title, 400) && text(s.url, 2000) && /^https:\/\//.test(s.url))))
    && validBaseline
    && (value.adaptation === undefined || (value.adaptation && text(value.adaptation.sourceRecipeId, 160) && text(value.adaptation.request, 4000) && text(value.adaptation.createdAt, 100) && optionalList(value.adaptation.changes) && optionalList(value.adaptation.considerations) && Array.isArray(value.adaptation.changes) && Array.isArray(value.adaptation.considerations) && ['openai', 'local'].includes(value.adaptation.source) && optionalText(value.adaptation.model, 100)));
}
