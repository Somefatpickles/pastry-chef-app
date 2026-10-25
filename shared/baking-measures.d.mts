import type { Ingredient } from '../src/types';
export type IngredientMeasureDisplay = { amount: string; note?: string; approximate: boolean };
export function displayIngredientAmount(ingredient: Ingredient): IngredientMeasureDisplay;
export function formatKitchenVolume(teaspoons: number): string;
