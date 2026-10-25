import type { Recipe } from './types';
import { advancedRecipes } from './recipes/advanced';
import { middleRecipes } from './recipes/middle';
import { basicRecipes } from './recipes/basics';

// All 68 original recipe IDs are retained so completion history stays associated
// with the correct bake. Revised ingredient/step IDs start fresh checklists.
export const recipes: Recipe[] = [...advancedRecipes, ...middleRecipes, ...basicRecipes].map(recipe => ({
  ...recipe,
  ingredients: recipe.ingredients.map(ingredient => recipe.id === 'churros' && ingredient.name === 'Neutral frying oil'
    ? { ...ingredient, scaleWithBatch: false }
    : ingredient),
}));
