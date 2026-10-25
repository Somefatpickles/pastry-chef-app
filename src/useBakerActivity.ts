import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { hasChefAccount } from '../shared/chef-session.mjs';
import { createBakeCompletion, mergeBakeActivity, nextFavoriteState, type BakeActivity, type BakeCompletion } from '../shared/bake-history.mjs';
import { claimGuestBakeActivity, loadBakeActivity, migrateLegacyBakeActivity, persistBakeActivity } from './localStore';
import { saveBakeCompletion, saveRecipeFavorite, subscribeToBakeActivity } from './progressStore';
import type { ProgressByRecipe, Recipe } from './types';

type Notify = (message: string, kind?: 'success' | 'error' | 'info') => void;
const emptyActivity = (): BakeActivity => ({ completions: [], favorites: {} });

/** Durable local writes happen before feedback or cloud uploads. */
export function useBakerActivity(user: User | null, authReady: boolean, legacyProgress: ProgressByRecipe, recipes: Recipe[], notify: Notify) {
  const owner = authReady && hasChefAccount(user) ? user!.uid : null;
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const notifyRef = useRef(notify); notifyRef.current = notify;
  const [session, setSession] = useState(() => {
    let activity: BakeActivity;
    try { activity = migrateLegacyBakeActivity(null, legacyProgress, recipes); }
    catch { activity = loadBakeActivity(null); }
    return { owner: null as string | null, activity };
  });
  const sessionRef = useRef(session);
  const [syncState, setSyncState] = useState('local');
  const [retryVersion, setRetryVersion] = useState(0);
  const generation = useRef(0);
  const cloudReady = useRef(false);
  const remoteConfirmed = useRef(false);
  const remoteRef = useRef<BakeActivity>(emptyActivity());
  const inFlight = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const latestUploads = useRef(new Map<string, string>());
  const errorNotified = useRef(false);
  const legacy = useRef<{ owner: string; progress: ProgressByRecipe; recipes: Recipe[] } | null>(null);
  const uploadRef = useRef<(activity: BakeActivity) => void>(() => {});
  const migrateRef = useRef<() => void>(() => {});

  const commit = useCallback((activity: BakeActivity) => {
    const currentOwner = ownerRef.current;
    if (sessionRef.current.owner !== currentOwner) return null;
    try {
      const saved = persistBakeActivity(currentOwner, activity);
      const next = { owner: currentOwner, activity: saved };
      sessionRef.current = next; setSession(next);
      return saved;
    } catch {
      notifyRef.current('This browser could not save your baking history or favorites. Storage may be full or disabled.', 'error');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const revision = ++generation.current;
    const isCurrent = () => generation.current === revision && ownerRef.current === owner;
    cloudReady.current = false; remoteConfirmed.current = false; remoteRef.current = emptyActivity();
    inFlight.current = new Set(); failed.current = new Set(); latestUploads.current = new Map(); errorNotified.current = false;
    let activity = loadBakeActivity(owner);
    try { if (owner) activity = claimGuestBakeActivity(owner); }
    catch { notifyRef.current('Your guest bakes could not be moved into this profile. They are still saved on this device.', 'error'); }
    sessionRef.current = { owner, activity }; setSession(sessionRef.current);
    setSyncState(owner ? 'loading' : 'local');
    const reportSync = () => {
      if (isCurrent()) setSyncState(failed.current.size ? 'error' : inFlight.current.size ? 'syncing' : remoteConfirmed.current ? 'ready' : 'loading');
    };
    uploadRef.current = local => {
      if (!owner || !cloudReady.current || !isCurrent()) return;
      const remote = remoteRef.current;
      const queue = (entity: string, key: string, write: () => Promise<unknown>) => {
        if (inFlight.current.has(key)) return;
        latestUploads.current.set(entity, key);
        inFlight.current.add(key); failed.current.delete(entity); reportSync();
        void write().then(() => {
          if (isCurrent() && latestUploads.current.get(entity) === key) failed.current.delete(entity);
        }).catch(() => {
          if (!isCurrent() || latestUploads.current.get(entity) !== key) return;
          failed.current.add(entity);
          if (!errorNotified.current) {
            errorNotified.current = true;
            notifyRef.current('Your bakes and favorites are saved on this device. Cloud sync could not finish; retry from Analytics or Profile.', 'error');
          }
        }).finally(() => {
          if (!isCurrent()) return;
          inFlight.current.delete(key); reportSync();
        });
      };
      const remoteEvents = new Map(remote.completions.map(event => [event.id, event]));
      for (const event of local.completions) {
        const before = remoteEvents.get(event.id);
        if (!before || (before.legacy && !event.legacy) || (event.deletedAt && (!before.deletedAt || event.deletedAt > before.deletedAt))) {
          queue(`bake:${event.id}`, `bake:${event.id}:${event.deletedAt ?? ''}:${event.legacy ? 'legacy' : 'bake'}`, () => saveBakeCompletion(owner, event));
        } else failed.current.delete(`bake:${event.id}`);
      }
      for (const [id, favorite] of Object.entries(local.favorites)) {
        const before = remote.favorites[id];
        if (!before || favorite.updatedAt > before.updatedAt || (favorite.updatedAt === before.updatedAt && !favorite.favorite && before.favorite)) {
          queue(`favorite:${id}`, `favorite:${id}:${favorite.updatedAt}`, () => saveRecipeFavorite(owner, id, favorite));
        } else failed.current.delete(`favorite:${id}`);
      }
      reportSync();
    };
    migrateRef.current = () => {
      if (!owner || !isCurrent() || !remoteConfirmed.current || legacy.current?.owner !== owner) return;
      try {
        const migrated = migrateLegacyBakeActivity(owner, legacy.current.progress, legacy.current.recipes);
        const next = { owner, activity: mergeBakeActivity(sessionRef.current.activity, migrated) };
        sessionRef.current = next; setSession(next); uploadRef.current(next.activity);
      } catch { notifyRef.current('Earlier completion dates could not be saved. Your existing progress is unchanged.', 'error'); }
    };
    if (!owner) return () => { generation.current++; };
    const unsubscribe = subscribeToBakeActivity(owner, (remote, metadata) => {
      if (!isCurrent()) return;
      remoteRef.current = remote;
      const merged = mergeBakeActivity(sessionRef.current.activity, remote);
      const saved = commit(merged);
      cloudReady.current = true;
      remoteConfirmed.current = !metadata.fromCache;
      if (remoteConfirmed.current && metadata.legacyProgress) legacy.current = { owner, progress: metadata.legacyProgress, recipes };
      if (saved) { reportSync(); migrateRef.current(); uploadRef.current(sessionRef.current.activity); }
      else setSyncState('error');
    }, () => {
      if (isCurrent()) { cloudReady.current = false; remoteConfirmed.current = false; setSyncState('error'); }
    });
    return () => { generation.current++; cloudReady.current = false; unsubscribe(); };
  }, [owner, authReady, retryVersion, commit]);

  const toggleFavorite = useCallback((recipe: Recipe) => {
    if (!authReady) { notifyRef.current('Your profile is still loading. Try again in a moment.'); return; }
    const current = sessionRef.current.activity;
    const value = nextFavoriteState(current.favorites[recipe.id], !current.favorites[recipe.id]?.favorite);
    const saved = commit({ ...current, favorites: { ...current.favorites, [recipe.id]: value } });
    if (saved) { uploadRef.current(saved); notifyRef.current(value.favorite ? `“${recipe.title}” added to favorites.` : `“${recipe.title}” removed from favorites.`, 'success'); }
  }, [authReady, commit]);
  const addCompletion = useCallback((recipe: Recipe, recipeId: string): BakeCompletion | null => {
    if (!authReady) { notifyRef.current('Your profile is still loading. Try again in a moment.'); return null; }
    const current = sessionRef.current.activity;
    const existingTimes = new Set(current.completions.filter(event => event.recipeId === recipeId).map(event => Date.parse(event.completedAt)));
    let completedAt = Date.now();
    while (existingTimes.has(completedAt)) completedAt++;
    const event = createBakeCompletion(recipe, { recipeId, completedAt });
    const saved = commit({ ...current, completions: [...current.completions, event] });
    if (!saved) return null;
    uploadRef.current(saved); notifyRef.current(`“${recipe.title}” logged as completed. Each bake is saved separately.`, 'success');
    return event;
  }, [authReady, commit]);
  const removeCompletion = useCallback((id: string): BakeCompletion | null => {
    const current = sessionRef.current.activity;
    const event = current.completions.find(item => item.id === id && !item.deletedAt);
    if (!event) return null;
    const removed = { ...event, deletedAt: new Date().toISOString() };
    const saved = commit({ ...current, completions: current.completions.map(item => item.id === id ? removed : item) });
    if (!saved) return null;
    uploadRef.current(saved); notifyRef.current('Bake removed from your history.', 'success');
    return removed;
  }, [commit]);
  return {
    activity: session.owner === owner ? session.activity : emptyActivity(), syncState,
    addCompletion, removeCompletion, toggleFavorite,
    retrySync: () => setRetryVersion(value => value + 1),
  };
}
