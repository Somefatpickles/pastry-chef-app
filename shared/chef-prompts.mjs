import { shuffleForLoad } from './recipe-order.mjs';

export const chefPromptSuggestions = Object.freeze([
  'Multiply all ingredients by 2.5',
  'Make a half batch and help me measure small amounts.',
  'I’m missing an ingredient. Ask what I have, then suggest a substitute.',
  'I need to avoid an allergen. Ask which one and review ingredient-label details.',
  'I have different equipment. Ask what I’m using before adapting this recipe.',
  'Can I make this less sweet while keeping a good texture?',
  'Help me plan which parts of this recipe I can make ahead.',
  'How should I store this, and can it be frozen?',
  'Which steps matter most for the texture, and what signs should I look for?',
  'Which ingredients need a particular temperature before I start?',
  'Help me adjust the serving size. Ask how many servings I need.',
  'Give me a practical step-by-step plan for this recipe.',
]);

/** Keep the result for this Chef session so typing never changes the examples. */
export function chooseChefPrompts(random = Math.random) {
  const suggestions = shuffleForLoad(chefPromptSuggestions, random).slice(0, 3);
  return { suggestions, placeholder: suggestions[Math.floor(random() * suggestions.length)] };
}
