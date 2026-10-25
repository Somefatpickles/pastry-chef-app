import { parseAmount } from './recipe-core.mjs';

// Display equivalents only. Canonical ingredient amounts are never rewritten.
// NIST's approximate kitchen equivalents: cup=240 ml, tbsp=15 ml, tsp=5 ml.
const GRAMS_PER_OUNCE = 28.349523125;
const normalizedName = ingredient => ingredient.name.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
const fractions = [[0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'], [1, '']];
const decimal = value => Number(value.toFixed(value < .01 ? 6 : value < 1 ? 3 : 2)).toString();
function niceNumber(value, tolerance = .011) {
  const whole = Math.floor(value);
  const nearest = fractions.reduce((best, next) => Math.abs(whole + next[0] - value) < Math.abs(whole + best[0] - value) ? next : best);
  const snapped = whole + nearest[0];
  if (snapped > 0 && Math.abs(snapped - value) / value <= tolerance) {
    if (nearest[0] === 1) return String(whole + 1);
    return `${whole || ''}${whole && nearest[1] ? ' ' : ''}${nearest[1]}`;
  }
  return decimal(value);
}

/** Familiar measures, retaining a residual spoon rather than changing the formula. */
export function formatKitchenVolume(teaspoons) {
  if (!Number.isFinite(teaspoons) || teaspoons < 0) return '';
  if (!teaspoons) return '0 tsp';
  const spoonMeasure = Math.round(teaspoons * 8) / 8;
  if (spoonMeasure > 0 && Math.abs(spoonMeasure - teaspoons) / teaspoons <= .011) teaspoons = spoonMeasure;
  if (teaspoons >= 12) {
    const cups = teaspoons / 48;
    const friendly = niceNumber(cups);
    if (!friendly.includes('.') && Math.abs(numberValue(friendly) * 48 - teaspoons) / teaspoons <= .011) return `${friendly} ${numberValue(friendly) <= 1 ? 'cup' : 'cups'}`;
  }
  const pieces = [];
  let remainder = teaspoons;
  if (remainder >= 12) {
    // Quarter-cup increments leave at most 4 tbsp to measure separately.
    const cups = Math.floor((remainder + 1e-9) / 12) / 4;
    pieces.push(`${niceNumber(cups, 1e-8)} ${cups <= 1 ? 'cup' : 'cups'}`);
    remainder -= cups * 48;
  }
  if (remainder >= 3 - 1e-8) {
    const tablespoons = Math.floor((remainder + 1e-8) / 3);
    pieces.push(`${tablespoons} tbsp`);
    remainder -= tablespoons * 3;
  }
  // Do not discard small quantities merely because a standard 1/8-tsp spoon is larger.
  if (remainder > .00001) pieces.push(`${niceNumber(remainder, Math.max(.011, Math.min(.25, teaspoons * .004 / remainder)))} tsp`);
  return pieces.join(' + ');
}

function numberValue(text) {
  return text.split(' ').reduce((sum, part) => {
    const [a, b] = part.split('/').map(Number);
    return sum + (b ? a / b : a);
  }, 0);
}

// Values below are published ingredient-specific equivalents, not a universal
// grams-to-cups conversion. See docs/measurements.md for researched sources.
function massBasis(ingredient) {
  const name = normalizedName(ingredient);
  const note = ingredient.note?.toLowerCase() ?? '';
  if (/\bor\b/.test(name)) return null;
  if (/gelatin|gelatine/.test(name)) return { perCup: 7 / 2.5 * 48, guide: 'Use level spoons of powdered gelatin and the bloom strength specified in the recipe.' };
  if (/yeast/.test(name)) return { perCup: 7 / 2.25 * 48, guide: 'Level teaspoons of dry yeast; this is not a fresh-yeast conversion.' };
  if (/baking powder/.test(name)) return { perCup: 4 * 48, guide: 'Use level measuring spoons.' };
  if (/baking soda|fine salt|table salt/.test(name)) return { perCup: 6 * 48, guide: /salt/.test(name) ? 'Use fine/table salt; kosher salts occupy different volumes.' : 'Use level measuring spoons.' };
  if (/instant espresso powder/.test(name)) return { perCup: 112, guide: 'Level the spoon of instant espresso powder; this is not ground coffee.' };
  if (/ground cinnamon/.test(name)) return { perCup: 2.4 * 48, guide: 'Use level teaspoons of ground cinnamon; grind and brand can change the spoon weight.' };
  if (/almond flour/.test(name)) return { perCup: 96, guide: 'Spoon fine almond flour into the cup and level without packing. Precision pastry is sensitive to cup packing.', precise: true };
  if (/all.purpose flour|bread flour/.test(name)) return { perCup: 120, guide: 'Fluff, spoon into the measuring cup, and level; do not scoop or pack.' };
  if (/cornstarch/.test(name)) return { perCup: 112, guide: 'Loosen lumps, then spoon and level.' };
  if (/^(?:(?:natural|unsweetened|dutch-process|dutch process)\s+)*cocoa(?: powder)?$/.test(name)) return { perCup: 84, guide: 'Loosen lumps, then spoon and level unsweetened cocoa.' };
  if (/confectioners|powdered sugar|icing sugar/.test(name)) return { perCup: 113, guide: 'Measure powdered sugar before sifting; spoon and level rather than packing.' };
  if (/brown sugar/.test(name)) return { perCup: 213, guide: 'Pack brown sugar into the measuring cup, then level.' };
  if (/granulated sugar/.test(name)) return { perCup: 198, guide: 'Level the cup without packing.' };
  if (/^(?:(?:refined|unrefined|virgin|extra virgin|solid)\s+)*coconut oil$/.test(name) || /^(?:(?:unsalted|salted|cold|softened|melted|cultured|european-style)\s+)*butter$/.test(name)) return { perCup: 226, guide: /coconut/.test(name) ? 'Measure solid coconut oil without air pockets; use the temperature/texture specified in the method.' : 'Use butter-wrapper markings or pack softened butter without air pockets.', precise: /laminat/.test(note) };
  if (/dairy.free.*(?:block|butter|stick)|(?:plant.based|vegan).*(?:butter|block|stick)/.test(name)) return { perCup: 226, guide: 'Use the baking block’s package cup/tablespoon markings; its fat and water content must match the requested adaptation.', precise: true };
  if (/neutral.*oil|vegetable oil|canola oil|sunflower oil/.test(name)) return { perCup: 224, guide: 'Measure liquid cooking oil at eye level.' };
  if (/sour cream/.test(name)) return { perCup: 227, guide: 'Fill and level a dry measuring cup.' };
  if (/^(?:heavy(?: whipping)? cream|whipping cream|whole milk|buttermilk|milk|evaporated milk)$/.test(name)) return { perCup: 227, guide: 'Measure liquid dairy before whipping, at eye level in a liquid measuring cup.' };
  if (/honey/.test(name)) return { perCup: 336, guide: 'Let the honey settle to the measuring line; scrape the full amount into the bowl.' };
  if (/peanut butter/.test(name)) return { perCup: 270, guide: 'Pack conventional smooth peanut butter into the cup with no air pockets; do not use separated natural peanut butter unless the recipe allows it.' };
  if (/jam|preserves/.test(name)) return { perCup: 340, guide: 'Use thick jam and level the measure; runny syrups have a different density.' };
  if (/rolled oats|old.fashioned.*oats/.test(name)) return { perCup: 89, guide: 'Measure dry old-fashioned oats without crushing or packing.' };
  if (/sweetened shredded coconut/.test(name) && !/unsweetened/.test(name)) return { perCup: 85, guide: 'Loosely fill the cup with sweetened shredded coconut.' };
  if (/unsweetened shredded coconut/.test(name)) return { perCup: 53, guide: 'Use loosely filled shredded coconut; desiccated powder and large flakes have different densities.' };
  if (/rice cereal|rice krisp/.test(name)) return { perCup: 28, guide: 'Loosely fill without crushing; use your brand’s cup-to-weight ratio if it differs.' };
  if (/raisins/.test(name)) return { perCup: 149, guide: 'Loosely fill the cup without compacting the raisins.' };
  if (/pecans/.test(name)) return { perCup: /chopp|dic/.test(note) ? 114 : 105, guide: /chopp|dic/.test(note) ? 'Measure diced/chopped pecans loosely.' : 'Measure whole pecans loosely, then prepare as directed.' };
  if (/sliced almonds/.test(name)) return { perCup: 86, guide: 'Measure sliced almonds loosely without crushing.' };
  if (/carrot/.test(name)) return { perCup: 99, guide: 'Measure freshly grated carrots loosely; do not pack or substitute dry bagged shreds.' };
  if (/banana/.test(name)) return { perCup: 227, guide: 'Peel and mash first, then fill and level the cup.' };
  if (/strawberries/.test(name)) return { perCup: 167, guide: 'Hull and slice the berries before measuring loosely.' };
  if (/blueberries/.test(name)) return { perCup: 155, guide: 'Loosely fill the cup with whole berries.' };
  if (/pitted cherries/.test(name)) return { perCup: 160, guide: 'Remove pits, then chop and loosely fill the cup; drain thawed fruit first. Whole cherries occupy a different volume.' };
  if (/\bapples\b/.test(name)) return { perCup: 113, guide: 'Peel and core, measure thin slices loosely, then dice further if directed; tightly packed diced apples have a different density.' };
  if (/chocolate chips/.test(name)) return { perCup: 170, guide: 'Use standard-size chocolate chips, loosely filled; miniature chips pack differently.' };
  return null;
}

/**
 * Primary ingredient display. The input, its canonical quantity, and scaling
 * remain untouched. Unknown masses keep weight in familiar ounces instead of
 * guessing a cup density.
 */
export function displayIngredientAmount(ingredient) {
  const parsed = parseAmount(ingredient.amount);
  if (!parsed) return { amount: ingredient.amount, approximate: false };
  const unit = parsed.unit.toLowerCase().replace(/\.$/, '');
  const quantity = parsed.quantity;
  if (!unit) return { amount: niceNumber(quantity, 1e-8), approximate: false };
  if (/^(?:cups?|tbsp|tablespoons?|tsp|teaspoons?)$/.test(unit)) {
    const teaspoons = quantity * (/^cup/.test(unit) ? 48 : /^(?:tbsp|tablespoon)/.test(unit) ? 3 : 1);
    return { amount: formatKitchenVolume(teaspoons), approximate: false };
  }
  if (/^(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)$/.test(unit)) {
    const milliliters = quantity * (/^(?:l|lit)/.test(unit) ? 1000 : 1);
    return { amount: formatKitchenVolume(milliliters / 5), note: /ice cream/i.test(ingredient.name) ? 'Measure gently softened ice cream without packing; keep cold until assembly.' : 'Use standard kitchen measuring cups/spoons, with the liquid level read at eye height.', approximate: true };
  }
  if (/^(?:fl oz|fluid ounces?)$/.test(unit)) return { amount: formatKitchenVolume(quantity * 6), note: 'Fluid ounces measure volume, not weight.', approximate: true };
  if (/^(?:oz|ounces?|lb|lbs|pounds?)$/.test(unit)) return { amount: `${niceNumber(quantity * (/^(?:lb|pound)/.test(unit) ? 16 : 1))} oz`, note: 'Ounces are by weight, not fluid ounces.', approximate: false };
  if (!/^(?:g|grams?|kg|kilograms?)$/.test(unit)) return { amount: ingredient.amount, approximate: false };
  const grams = quantity * (/^(?:kg|kilo)/.test(unit) ? 1000 : 1);
  if (/^(?:(?:fresh|large)\s+)*egg whites?$/.test(normalizedName(ingredient))) return { amount: `${niceNumber(grams / 30)} large egg ${grams === 30 ? 'white' : 'whites'}`, note: 'Separate the whites first. Beat before dividing a fractional white.', approximate: true };
  if (/^(?:(?:fresh|large)\s+)*egg yolks?$/.test(normalizedName(ingredient))) return { amount: `${niceNumber(grams / 18)} large egg ${grams === 18 ? 'yolk' : 'yolks'}`, note: 'Separate the yolks first. Beat before dividing a fractional yolk.', approximate: true };
  const basis = massBasis(ingredient);
  if (basis) return { amount: formatKitchenVolume(grams / basis.perCup * 48), note: basis.guide, approximate: true };
  const packaged = /puff pastry|chocolate|cream cheese|condensed milk|marshmallow|praline/.test(ingredient.name.toLowerCase());
  return { amount: `${niceNumber(grams / GRAMS_PER_OUNCE)} oz`, note: packaged ? 'Use the package weight markings.' : 'Measure ounces by weight.', approximate: true };
}
