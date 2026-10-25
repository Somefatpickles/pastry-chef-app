import type { Recipe } from '../src/types';
export function parseAmount(amount: string): { quantity: number; unit: string } | null;
export function formatQuantity(number: number): string;
export const batchConsiderations: string[];
export function scaleRecipe(recipe: Recipe, factor: number): Recipe;
export function isRecipe(value: unknown): value is Recipe;
