import type { Recipe } from '../src/types';

export function recipeContentKey(recipe: Recipe): string;
export function sameRecipeContent(first: Recipe, second: Recipe): boolean;

export type SavedRecipePlan = {
  status: 'added' | 'renamed' | 'unchanged' | 'duplicate';
  recipes: Recipe[];
  recipe: Recipe;
} | {
  status: 'full';
  recipes: Recipe[];
  recipe: null;
};

export function planSavedRecipe(options: {
  recipes: Recipe[];
  candidate: Recipe;
  selectedId?: string;
  limit?: number;
}): SavedRecipePlan;

export type RecipeImportPlan = {
  status: 'imported' | 'unchanged' | 'full';
  recipes: Recipe[];
  added: number;
  skipped: number;
  rejected: number;
};

export function planRecipeImport(options: {
  recipes: Recipe[];
  candidates: Recipe[];
  limit?: number;
}): RecipeImportPlan;
