import { collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, type DocumentReference } from "firebase/firestore";

import { firestore } from "./firebase";
import type { ProgressByRecipe } from "./types";
import { isBakeCompletion, isFavoriteState, mergeBakeActivity, mergeBakeCompletions, mergeRecipeFavorites, normalizeBakeActivity, type BakeActivity, type BakeCompletion, type FavoriteState } from '../shared/bake-history.mjs';

const profileDocument = (userId: string) => {
  if (!firestore) {
    throw new Error("Firebase is not configured.");
  }

  return doc(firestore, "bakingProfiles", userId);
};

export function subscribeToProgress(
  userId: string,
  onChange: (progress: ProgressByRecipe | null) => void,
  onError: () => void,
) {
  return onSnapshot(
    profileDocument(userId),
    (snapshot) => {
      const data = snapshot.data();
      onChange((data?.progressByRecipe as ProgressByRecipe | undefined) ?? null);
    },
    onError,
  );
}

export function saveProgress(userId: string, progressByRecipe: ProgressByRecipe) {
  return setDoc(
    profileDocument(userId),
    {
      progressByRecipe,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

const permissionDenied = (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied';
const activityCollection = (userId: string, kind: 'completions' | 'favorites') => collection(profileDocument(userId), kind);
const fallbackCollections = new Set<string>();
const mapValues = (value: unknown): unknown[] => value && typeof value === 'object' && !Array.isArray(value) ? Object.values(value) : [];
function cloudFavorites(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    let decoded = key;
    try { decoded = decodeURIComponent(key); } catch { /* Preserve a legacy literal key. */ }
    const recipeId = entry && typeof entry === 'object' && 'recipeId' in entry && typeof entry.recipeId === 'string' ? entry.recipeId : decoded;
    return [recipeId, entry];
  }));
}

/**
 * Subcollections scale beyond one document. Existing installations whose rules
 * only permit the profile document transparently use its per-ID activity maps.
 */
export function subscribeToBakeActivity(userId: string, onChange: (activity: BakeActivity, metadata: { fromCache: boolean; legacyProgress?: ProgressByRecipe | null }) => void, onError: () => void) {
  let active = true;
  let failed = false;
  const fail = () => { if (active && !failed) { failed = true; onError(); } };
  fallbackCollections.delete(`${userId}:completions`); fallbackCollections.delete(`${userId}:favorites`);
  const sources: BakeActivity[] = [normalizeBakeActivity(null), normalizeBakeActivity(null), normalizeBakeActivity(null)];
  const ready = [false, false, false];
  const fromCache = [true, true, true];
  let legacyProgress: ProgressByRecipe | null = null;
  const emit = (index: number, activity: BakeActivity, cached = false) => {
    if (!active || failed) return;
    sources[index] = activity; ready[index] = true; fromCache[index] = cached;
    if (ready.every(Boolean)) onChange(mergeBakeActivity(...sources), { fromCache: fromCache.some(Boolean), legacyProgress });
  };
  const parent = onSnapshot(profileDocument(userId), { includeMetadataChanges: true }, snapshot => {
    const data = snapshot.data(), value = data?.bakeActivity;
    legacyProgress = data?.progressByRecipe && typeof data.progressByRecipe === 'object' && !Array.isArray(data.progressByRecipe) ? data.progressByRecipe as ProgressByRecipe : null;
    emit(0, normalizeBakeActivity({ completions: mapValues(value?.completionsById), favorites: cloudFavorites(value?.favoritesByRecipe) }), snapshot.metadata.fromCache);
  }, fail);
  const completions = onSnapshot(activityCollection(userId, 'completions'), { includeMetadataChanges: true }, snapshot => {
    fallbackCollections.delete(`${userId}:completions`);
    emit(1, normalizeBakeActivity({ completions: snapshot.docs.map(item => item.data()), favorites: {} }), snapshot.metadata.fromCache);
  }, error => { if (active && !failed) { if (permissionDenied(error)) { fallbackCollections.add(`${userId}:completions`); emit(1, normalizeBakeActivity(null)); } else fail(); } });
  const favorites = onSnapshot(activityCollection(userId, 'favorites'), { includeMetadataChanges: true }, snapshot => {
    fallbackCollections.delete(`${userId}:favorites`);
    emit(2, normalizeBakeActivity({ completions: [], favorites: Object.fromEntries(snapshot.docs.map(item => { const value = item.data(); return [value.recipeId, value]; }).filter(([id]) => typeof id === 'string')) }), snapshot.metadata.fromCache);
  }, error => { if (active && !failed) { if (permissionDenied(error)) { fallbackCollections.add(`${userId}:favorites`); emit(2, normalizeBakeActivity(null)); } else fail(); } });
  return () => { active = false; parent(); completions(); favorites(); };
}

export async function saveBakeCompletion(userId: string, completion: BakeCompletion) {
  if (!isBakeCompletion(completion)) throw new Error('The bake completion is incomplete.');
  const value = normalizeBakeActivity({ completions: [completion] }).completions[0];
  if (fallbackCollections.has(`${userId}:completions`)) return writeCompletion(profileDocument(userId), value, true);
  try {
    await writeCompletion(doc(activityCollection(userId, 'completions'), value.id), value, false);
  } catch (error) {
    if (!permissionDenied(error)) throw error;
    fallbackCollections.add(`${userId}:completions`);
    await writeCompletion(profileDocument(userId), value, true);
  }
}

async function writeCompletion(reference: DocumentReference, completion: BakeCompletion, fallback: boolean) {
  if (!firestore) throw new Error('Firebase is not configured.');
  await runTransaction(firestore, async transaction => {
    const snapshot = await transaction.get(reference);
    const existing = fallback ? snapshot.data()?.bakeActivity?.completionsById?.[completion.id] : snapshot.data();
    const merged = mergeBakeCompletions([existing], [completion])[0];
    if (isBakeCompletion(existing) && JSON.stringify(mergeBakeCompletions([existing])[0]) === JSON.stringify(merged)) return;
    // Keep false explicit so promoting a legacy entry clears its marker on merge.
    const value = { ...merged, legacy: merged.legacy === true };
    transaction.set(reference, fallback ? { bakeActivity: { completionsById: { [completion.id]: value } }, updatedAt: serverTimestamp() } : { ...value, updatedServerAt: serverTimestamp() }, { merge: true });
  });
}

async function writeFavorite(reference: DocumentReference, recipeId: string, state: FavoriteState, fallback: boolean) {
  if (!firestore) throw new Error('Firebase is not configured.');
  await runTransaction(firestore, async transaction => {
    const snapshot = await transaction.get(reference);
    const existing = fallback ? snapshot.data()?.bakeActivity?.favoritesByRecipe?.[encodeURIComponent(recipeId)] : snapshot.data();
    const merged = mergeRecipeFavorites({ [recipeId]: existing }, { [recipeId]: state })[recipeId];
    if (isFavoriteState(existing) && merged.updatedAt === existing.updatedAt && merged.favorite === existing.favorite) return;
    transaction.set(reference, fallback ? { bakeActivity: { favoritesByRecipe: { [encodeURIComponent(recipeId)]: { recipeId, ...merged } } }, updatedAt: serverTimestamp() } : { recipeId, ...merged, updatedServerAt: serverTimestamp() }, { merge: true });
  });
}

export async function saveRecipeFavorite(userId: string, recipeId: string, state: FavoriteState) {
  if (!recipeId.trim() || recipeId.length > 500 || !isFavoriteState(state)) throw new Error('This favorite could not be saved.');
  if (fallbackCollections.has(`${userId}:favorites`)) return writeFavorite(profileDocument(userId), recipeId, state, true);
  try { await writeFavorite(doc(activityCollection(userId, 'favorites'), encodeURIComponent(recipeId)), recipeId, state, false); }
  catch (error) {
    if (!permissionDenied(error)) throw error;
    fallbackCollections.add(`${userId}:favorites`);
    await writeFavorite(profileDocument(userId), recipeId, state, true);
  }
}
