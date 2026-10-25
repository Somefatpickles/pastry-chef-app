import { displayIngredientAmount, formatKitchenVolume } from './baking-measures.mjs';

const NUMBER = String.raw`(?:\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const RANGE = `${NUMBER}(?:\\s*[–—-]\\s*${NUMBER})?`;
const TEMPERATURE_RANGE = `[+-]?${NUMBER}(?:\\s*[–—-]\\s*[+-]?${NUMBER})?`;
const MASS = '(?:kilograms?|milligrams?|grams?|kg|mg|g)';
const VOLUME = '(?:millilit(?:er|re)s?|lit(?:er|re)s?|ml|l)';
const LENGTH = '(?:centimet(?:er|re)s?|millimet(?:er|re)s?|met(?:er|re)s?|cm|mm)';
const METRIC = `(?:${MASS}|${VOLUME}|${LENGTH})`;
const IMPERIAL = '(?:inches|inch|in\\.|ounces?|oz|cups?|tablespoons?|tbsp|teaspoons?|tsp|feet|foot|ft)';
const fractions = { '¼': .25, '½': .5, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };
const round = number => Number(number.toFixed(Math.abs(number) < .01 ? 6 : 2)).toString();
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Numeric-unit detection, without matching words such as "programs". */
export const metricUnitPattern = new RegExp(`(?:${NUMBER})\\s*(?:${METRIC}\\b|(?:°\\s*|degrees?\\s*)?(?:Celsius\\b|C\\b))`, 'i');
export const measurementNoticePattern = /\bapprox\.|\bapproximat(?:e|ely|ion|ions)\b|\bprecise original (?:amount|quantity|weight)\b/i;

function numeric(value) {
  const clean = value.trim().replaceAll(',', '').replace(/\s*\/\s*/g, '/').replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g, '$1 $2').replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, fraction => String(fractions[fraction]));
  if (fractions[clean] !== undefined) return fractions[clean];
  return clean.split(/\s+/).reduce((total, part) => {
    const [a, b] = part.split('/').map(Number);
    return total + (b === undefined ? a : a / b);
  }, 0);
}

function joinRange(parts) {
  if (parts.length === 1) return parts[0];
  const first = parts[0].match(/^(.*)\s+(cup|cups|tbsp|tsp|oz|inches|inch|°F)$/);
  const last = parts[1].match(/^(.*)\s+(cup|cups|tbsp|tsp|oz|inches|inch|°F)$/);
  if (first && last && first[2].replace(/s$/, '') === last[2].replace(/s$/, '')) return `${first[1]}–${last[1]} ${last[2]}`;
  return parts.join('–');
}

function values(value) { return value.trim().split(/\s*[–—-]\s*/).map(numeric); }
function temperatureValues(value) {
  const match = value.trim().match(new RegExp(`^([+-]?${NUMBER})(?:\\s*[–—-]\\s*([+-]?${NUMBER}))?$`));
  return match ? [match[1], match[2]].filter(part => part !== undefined).map(part => part.startsWith('-') ? -numeric(part.slice(1)) : numeric(part.replace(/^\+/, ''))) : [];
}
function unitKind(unit) {
  if (/^(?:kg|kilogram)/i.test(unit)) return ['mass', 1000];
  if (/^(?:mg|milligram)/i.test(unit)) return ['mass', .001];
  if (/^(?:g|gram)/i.test(unit)) return ['mass', 1];
  if (/^(?:ml|millilit)/i.test(unit)) return ['volume', 1];
  if (/^(?:l|lit)/i.test(unit)) return ['volume', 1000];
  if (/^(?:mm|millimet)/i.test(unit)) return ['length', 1 / 25.4];
  if (/^(?:cm|centimet)/i.test(unit)) return ['length', 1 / 2.54];
  return ['length', 100 / 2.54];
}

const aliases = ingredient => {
  const name = ingredient.name.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const simple = name.replace(/^(?:(?:refined|unrefined|unsalted|salted|large|fine|whole|full-fat|cold|softened|fresh|very ripe|peeled|light)\s+)+/i, '');
  return [...new Set([name, simple])].filter(alias => alias.length > 2);
};

// Only assign a food density when the nearby words identify its ingredient.
function ingredientNear(text, start, end, ingredients) {
  const after = text.slice(end).replace(/^\s*(?:of\s+)?(?:the\s+)?/i, '');
  const before = text.slice(Math.max(0, start - 90), start);
  let prior = null;
  for (const ingredient of ingredients) for (const alias of aliases(ingredient)) {
    if (new RegExp(`^${escape(alias)}(?=\\b|$)`, 'i').test(after)) return ingredient;
    if (new RegExp(`${escape(alias)}\\s*[:=(]?\\s*$`, 'i').test(before)) prior = ingredient;
  }
  if (prior) return prior;
  const common = [
    [/^(?:all-purpose\s+|bread\s+)?flour\b/i, 'All-purpose flour'],
    [/^(?:refined\s+|virgin\s+)?coconut oil\b/i, 'Refined coconut oil'],
    [/^(?:unsalted\s+|salted\s+)?butter\b/i, 'Unsalted butter'],
    [/^(?:vegetable\s+|neutral\s+|canola\s+)?oil\b/i, 'Vegetable oil'],
    [/^(?:granulated\s+)?sugar\b/i, 'Granulated sugar'],
    [/^(?:light\s+|dark\s+)?brown sugar\b/i, 'Brown sugar'],
    [/^(?:powdered|confectioners') sugar\b/i, 'Powdered sugar'],
    [/^(?:(?:unflavored|powdered)\s+)*gelatin(?:e)?\b/i, 'Unflavored powdered gelatin'],
    [/^(?:instant\s+|dry\s+|active\s+)*yeast\b/i, 'Instant yeast'],
    [/^water\b/i, 'Water'], [/^(?:whole\s+)?milk\b/i, 'Whole milk'],
    [/^(?:heavy\s+|whipping\s+)?cream\b/i, 'Heavy cream'],
    [/^(?:large\s+)?egg whites?\b/i, 'Egg whites'], [/^(?:large\s+)?egg yolks?\b/i, 'Egg yolks'],
  ];
  for (const [pattern, name] of common) if (pattern.test(after)) return { name };
  return { name: 'Measured ingredient' };
}

function convertMeasure(number, unit, ingredient) {
  const [kind, multiplier] = unitKind(unit);
  if (kind === 'volume') return formatKitchenVolume(number * multiplier / 5);
  if (kind === 'length') return `${round(number * multiplier)} inches`;
  const grams = number * multiplier;
  if (/^water$/i.test(ingredient.name)) return formatKitchenVolume(grams / 5);
  return displayIngredientAmount({ id: 'text-measure', ...ingredient, amount: `${grams} g` }).amount;
}

function clearMeasurementNotices(text) {
  return text
    .replace(/\b(?:Precise|Exact) original (?:amount|quantity|weight):[^!?]*?(?:\.(?=\s|$)|$)\s*/gi, '')
    .replace(/\bApproximate cup\/spoon equivalent\.?\s*/gi, '')
    .replace(/\b(?:this count is|this is|these are|the conversion is|the equivalent is)\s+(?:an?\s+)?approximat(?:e|ion)\.?\s*/gi, '')
    .replace(/\b(?:an?\s+)?approximat(?:e|ely|ion|ions)\s*/gi, '')
    .replace(/\bapprox\.\s*/gi, '')
    .replace(/\b(?:precise original|original metric) (?:amount|quantity|weight)\b/gi, 'listed amount');
}

/** Convert display prose only; never use projected quantities for canonical arithmetic. */
export function toUsText(value, { ingredients = [] } = {}) {
  if (typeof value !== 'string' || !value) return value;
  let text = clearMeasurementNotices(value);
  const wordNumbers = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: .5, quarter: .25 };
  text = text.replace(new RegExp(`\\b(half a|a half|a quarter|quarter of a|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|quarter)\\s+(${METRIC})\\b`, 'gi'), (_, count, unit) => `${/half/i.test(count) ? .5 : /quarter/i.test(count) ? .25 : wordNumbers[count.toLowerCase()]} ${unit}`);
  // Prefer an already supplied customary counterpart over displaying it twice.
  const fahrenheit = `${TEMPERATURE_RANGE}\\s*(?:°\\s*F|degrees?\\s*Fahrenheit|Fahrenheit|F\\b)`;
  const celsius = `${TEMPERATURE_RANGE}\\s*(?:°\\s*C|degrees?\\s*Celsius|Celsius|C\\b)`;
  text = text.replace(new RegExp(`(${fahrenheit})\\s*(?:/|\\(|\\[)\\s*${celsius}\\s*[)\\]]?`, 'gi'), '$1 ');
  const dimension = `${RANGE}(?:\\s*[×x]\\s*${RANGE})*`;
  text = text.replace(new RegExp(`(${dimension}\\s*[- ]?\\s*${IMPERIAL})\\s*(?:/|\\(|\\[)\\s*${dimension}\\s*${METRIC}\\b\\s*[)\\]]?`, 'gi'), '$1 ');
  // Celsius first avoids interpreting its number as part of another measure.
  text = text.replace(new RegExp(`(${TEMPERATURE_RANGE})\\s*(?:°\\s*C|degrees?\\s*Celsius|Celsius|C\\b)`, 'gi'), (_, range) => joinRange(temperatureValues(range).map(number => `${Math.round(number * 9 / 5 + 32)} °F`)));
  text = text.replace(new RegExp(`(${dimension})\\s*(${LENGTH})\\b`, 'gi'), (match, dimensions, unit, offset, source) => {
    const [kind, multiplier] = unitKind(unit);
    if (kind !== 'length') return match;
    const converted = dimensions.split(/\s*[×x]\s*/).map(range => values(range).map(number => round(number * multiplier)).join('–')).join(' × ');
    const unitLabel = converted === '1' || /^\s*-/.test(source.slice(offset + match.length)) ? 'inch' : 'inches';
    return `${converted} ${unitLabel}`;
  });
  text = text.replace(new RegExp(`(${RANGE})\\s*(${MASS}|${VOLUME})\\b`, 'gi'), (match, range, unit, offset, source) => {
    const ingredient = ingredientNear(source, offset, offset + match.length, ingredients);
    return joinRange(values(range).map(number => convertMeasure(number, unit, ingredient)));
  });
  // Unit-only wording is also user-visible, including legacy AI guidance.
  text = text.replace(/\(\s*(?:g|kg|mg|ml|l|cm|mm|°?\s*C)\s*\)/gi, '')
    .replace(/\b(?:kilograms?|milligrams?|grams?)\b/gi, 'ounces')
    .replace(/\b(?:millilit(?:er|re)s?|lit(?:er|re)s?)\b/gi, 'cups')
    .replace(/\b(?:centimet(?:er|re)s?|millimet(?:er|re)s?|met(?:er|re)s?)\b/gi, 'inches')
    .replace(/\bCelsius\b/gi, 'Fahrenheit')
    .replace(/\b(?:kg|mg|g)\b/g, 'oz')
    .replace(/\b(?:mL|ml)\b/g, 'cups')
    .replace(/\b(?:cm|mm)\b/g, 'inches')
    .replace(/°\s*C\b/g, '°F')
    .replace(/\bmetric measurements?\b/gi, 'standard measurements');
  return text.replace(/\(\s*\)/g, '').replace(/\s+([,.;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
}

export function toUsRecipe(recipe) {
  if (!recipe) return recipe;
  const context = { ingredients: recipe.ingredients ?? [] };
  const text = value => toUsText(value, context);
  const projected = { ...recipe };
  for (const field of ['title', 'category', 'blurb', 'time', 'yield', 'baseYield', 'storage']) if (typeof recipe[field] === 'string') projected[field] = text(recipe[field]);
  for (const field of ['equipment', 'notes', 'reviewNotes']) if (Array.isArray(recipe[field])) projected[field] = recipe[field].map(text).filter(Boolean);
  projected.ingredients = recipe.ingredients.map(ingredient => {
    let amount = displayIngredientAmount(ingredient).amount;
    // A rounded three-teaspoon carry becomes one tablespoon before rendering,
    // so projecting a displayed recipe again cannot change its quantity label.
    for (let attempt = 0; attempt < 3; attempt++) {
      const normalized = displayIngredientAmount({ ...ingredient, amount }).amount;
      if (normalized === amount) break;
      amount = normalized;
    }
    return { ...ingredient, name: text(ingredient.name), amount: text(amount), ...(ingredient.note ? { note: text(ingredient.note) } : {}) };
  });
  projected.steps = recipe.steps.map(step => ({ ...step, title: text(step.title), detail: text(step.detail), ...(step.why ? { why: text(step.why) } : {}), ...(step.tip ? { tip: text(step.tip) } : {}) }));
  if (recipe.sources) projected.sources = recipe.sources.map(source => ({ ...source, title: text(source.title) }));
  if (recipe.adaptation) projected.adaptation = { ...recipe.adaptation, request: text(recipe.adaptation.request), changes: recipe.adaptation.changes.map(text).filter(Boolean), considerations: recipe.adaptation.considerations.map(text).filter(Boolean), ...(recipe.adaptation.before ? { before: toUsRecipe(recipe.adaptation.before) } : {}) };
  return projected;
}

export function toUsChefResult(result) {
  if (!result) return result;
  const context = { ingredients: result.recipe?.ingredients ?? [] };
  return { ...result, recipe: toUsRecipe(result.recipe), summary: toUsText(result.summary, context), changes: result.changes.map(value => toUsText(value, context)), considerations: result.considerations.map(value => toUsText(value, context)), questions: result.questions.map(value => toUsText(value, context)) };
}
