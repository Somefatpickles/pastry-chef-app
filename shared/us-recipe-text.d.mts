import type { ChefResult, Ingredient, Recipe } from '../src/types';
export const metricUnitPattern: RegExp;
export const measurementNoticePattern: RegExp;
export function toUsText(text: string, options?: { ingredients?: Ingredient[] }): string;
export function toUsRecipe<T extends Recipe | null | undefined>(recipe: T): T;
export function toUsChefResult<T extends ChefResult | null | undefined>(result: T): T;
