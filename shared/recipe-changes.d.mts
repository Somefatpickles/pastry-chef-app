import type { Ingredient, Recipe, RecipeStep } from '../src/types';

export type IngredientChange = {
  changed: boolean;
  added: boolean;
  fields: Record<'name' | 'amount' | 'note' | 'scaleWithBatch', boolean>;
  previous?: Ingredient;
};
export type StepChange = {
  changed: boolean;
  added: boolean;
  moved: boolean;
  fields: Record<'title' | 'detail' | 'why' | 'tip', boolean>;
  previous?: RecipeStep;
};
export type RecipeChanges = {
  changed: boolean;
  fields: Record<'title' | 'blurb' | 'time' | 'yield' | 'difficulty' | 'category' | 'equipment' | 'notes' | 'storage', boolean>;
  ingredients: Record<string, IngredientChange>;
  steps: Record<string, StepChange>;
  removedIngredients: Ingredient[];
  removedSteps: RecipeStep[];
};
export function getRecipeChanges(before: Recipe | null | undefined, after: Recipe | null | undefined): RecipeChanges;
