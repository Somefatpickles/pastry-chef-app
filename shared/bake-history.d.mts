import type { Recipe, ProgressByRecipe } from '../src/types';

export type BakeCompletion = {
  id: string; recipeId: string; sourceRecipeId: string; title: string;
  difficulty: Recipe['difficulty']; category: string; completedAt: string; deletedAt?: string; legacy?: boolean;
};
export type FavoriteState = { favorite: boolean; updatedAt: string };
export type FavoritesByRecipe = Record<string, FavoriteState>;
export type BakeActivity = { completions: BakeCompletion[]; favorites: FavoritesByRecipe };
export type BakeAnalyticsOptions = { metric?: 'total' | 'difficulty' | 'category' | 'unique'; interval?: 'day' | 'week' | 'month'; rangeDays?: number | null; category?: string; now?: Date | string | number };
export type BakeAnalyticsBucket = { key: string; label: string; start: string; end: string; total: number; cumulative: number; values: Record<string, number> };
export type BakeAnalytics = { buckets: BakeAnalyticsBucket[]; seriesKeys: string[]; totalCompletions: number; uniqueRecipes: number; categories: string[]; rangeStart: string; rangeEnd: string };
export function isBakeCompletion(value: unknown): value is BakeCompletion;
export function completionId(recipeId: string, completedAt: Date | string | number): string;
export function createBakeCompletion(recipe: Recipe, options?: { id?: string; completedAt?: Date | string | number; recipeId?: string }): BakeCompletion;
export function mergeBakeCompletions(...values: unknown[]): BakeCompletion[];
export function isFavoriteState(value: unknown): value is FavoriteState;
export function nextFavoriteState(current: FavoriteState | undefined, favorite: boolean, now?: Date | string | number): FavoriteState;
export function mergeRecipeFavorites(...values: unknown[]): FavoritesByRecipe;
export function normalizeBakeActivity(value: unknown): BakeActivity;
export function mergeBakeActivity(...values: unknown[]): BakeActivity;
export function migrateLegacyCompletions(progress: ProgressByRecipe, recipes: Recipe[]): BakeCompletion[];
export function buildBakeAnalytics(values: BakeCompletion[], options?: BakeAnalyticsOptions): BakeAnalytics;
