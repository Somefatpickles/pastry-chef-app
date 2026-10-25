import type { Recipe } from '../src/types';
export function availableCategories(recipes: Recipe[], difficulty?: string): string[];
export function normalizeCategory(recipes: Recipe[], difficulty: string, category: string): string;
export function matchesRecipeFilters(recipe: Recipe, filters?: { category?: string; difficulty?: string; search?: string; status?: string; favorites?: string; completed?: boolean; favorite?: boolean }): boolean;
