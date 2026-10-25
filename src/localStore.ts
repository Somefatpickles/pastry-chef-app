import type { Recipe, ProgressByRecipe } from './types';
import { isRecipe } from '../shared/recipe-core.mjs';
import { mergeBakeActivity, migrateLegacyCompletions, normalizeBakeActivity, type BakeActivity } from '../shared/bake-history.mjs';

export const savedRecipesKey = 'pastry-chef.saved-recipes.v1';
const progressKey = 'pastry-chef.local-progress.v1';
export const bakeActivityKey = 'pastry-chef.bake-activity.v1';

type BakeEnvelope = { version: 1; owners: Record<string, BakeActivity>; guestClaimedBy?: string; legacyMigratedOwners?: string[] };
const ownerKey = (owner: string | null) => owner === null ? 'guest' : `user:${owner}`;
function readBakeEnvelope(): BakeEnvelope {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(bakeActivityKey) ?? 'null');
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('owners' in value) || !value.owners || typeof value.owners !== 'object' || Array.isArray(value.owners)) return { version: 1, owners: {} };
    return {
      version: 1,
      owners: Object.fromEntries(Object.entries(value.owners).map(([key, activity]) => [key, normalizeBakeActivity(activity)])),
      ...('guestClaimedBy' in value && typeof value.guestClaimedBy === 'string' && value.guestClaimedBy ? { guestClaimedBy: value.guestClaimedBy } : {}),
      legacyMigratedOwners: 'legacyMigratedOwners' in value && Array.isArray(value.legacyMigratedOwners) ? value.legacyMigratedOwners.filter((owner): owner is string => typeof owner === 'string') : 'legacyMigrated' in value && value.legacyMigrated === true ? ['guest'] : [],
    };
  } catch { return { version: 1, owners: {} }; }
}

export function loadBakeActivity(owner: string | null = null): BakeActivity {
  return normalizeBakeActivity(readBakeEnvelope().owners[ownerKey(owner)]);
}

/** Per-ID merges preserve edits made by another mounted view before a write. */
export function persistBakeActivity(owner: string | null, activity: BakeActivity): BakeActivity {
  const envelope = readBakeEnvelope(), key = ownerKey(owner);
  const merged = mergeBakeActivity(envelope.owners[key], activity);
  localStorage.setItem(bakeActivityKey, JSON.stringify({ ...envelope, owners: { ...envelope.owners, [key]: merged } }));
  return merged;
}

/** The account copy, one-time marker and guest clearing share one atomic write. */
export function claimGuestBakeActivity(owner: string): BakeActivity {
  if (!owner) throw new Error('Sign in before claiming baking history.');
  const envelope = readBakeEnvelope(), key = ownerKey(owner);
  if (envelope.guestClaimedBy && envelope.guestClaimedBy !== owner) return normalizeBakeActivity(envelope.owners[key]);
  const merged = mergeBakeActivity(envelope.owners[key], envelope.owners.guest);
  localStorage.setItem(bakeActivityKey, JSON.stringify({ ...envelope, guestClaimedBy: owner, owners: { ...envelope.owners, [key]: merged, guest: normalizeBakeActivity(null) } }));
  return merged;
}

/** Migrate known latest dates once per owner; callers supply that owner's data. */
export function migrateLegacyBakeActivity(owner: string | null, progress: ProgressByRecipe, recipes: Recipe[]): BakeActivity {
  const envelope = readBakeEnvelope(), key = ownerKey(owner);
  if (envelope.legacyMigratedOwners?.includes(key)) return normalizeBakeActivity(envelope.owners[key]);
  const merged = mergeBakeActivity(envelope.owners[key], { completions: migrateLegacyCompletions(progress, recipes), favorites: {} });
  localStorage.setItem(bakeActivityKey, JSON.stringify({ ...envelope, legacyMigratedOwners: [...(envelope.legacyMigratedOwners ?? []), key], owners: { ...envelope.owners, [key]: merged } }));
  return merged;
}

export function loadSavedRecipes(): Recipe[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(savedRecipesKey) ?? '[]');
    return Array.isArray(value) ? value.filter(isRecipe).slice(0, 200) : [];
  } catch { return []; }
}

export function persistSavedRecipes(recipes: Recipe[]): void {
  localStorage.setItem(savedRecipesKey, JSON.stringify(recipes));
}

export function loadLocalProgress(): ProgressByRecipe {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(progressKey) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const validChecklist = (items: unknown) => items && typeof items === 'object' && !Array.isArray(items) && Object.values(items).every(v => typeof v === 'boolean');
    return Object.fromEntries(Object.entries(value).filter(([, p]) => p && typeof p === 'object' && validChecklist(p.ingredients) && validChecklist(p.steps) && (p.completedAt === undefined || (typeof p.completedAt === 'string' && Number.isFinite(Date.parse(p.completedAt))))));
  } catch { return {}; }
}

export function persistLocalProgress(progress: ProgressByRecipe): void {
  localStorage.setItem(progressKey, JSON.stringify(progress));
}
