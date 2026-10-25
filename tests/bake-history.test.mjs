import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { completionId, createBakeCompletion, isBakeCompletion, mergeBakeCompletions, nextFavoriteState, mergeRecipeFavorites, migrateLegacyCompletions, buildBakeAnalytics } from '../shared/bake-history.mjs';
import { bakeActivityKey, loadBakeActivity, persistBakeActivity, claimGuestBakeActivity, migrateLegacyBakeActivity } from '../src/localStore.ts';

const recipe = { id: 'snickerdoodle', title: 'Snickerdoodle Cookies', difficulty: 'Novice', category: 'Cookies', ingredients: [], steps: [] };
const event = (id, completedAt = '2026-10-24T12:00:00.000Z', patch = {}) => ({ ...createBakeCompletion(recipe, { id, completedAt }), ...patch });
const activity = (completions = [], favorites = {}) => ({ completions, favorites });
function withStorage(callback) {
  const previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try { return callback(values); } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
}

test('each bake gets an immutable independent ID and a recipe snapshot', () => {
  const first = createBakeCompletion(recipe), second = createBakeCompletion(recipe);
  assert.notEqual(first.id, second.id); assert.ok(isBakeCompletion(first));
  assert.equal(first.recipeId, recipe.id); assert.equal(first.title, recipe.title);
  const adapted = createBakeCompletion({ ...recipe, id: 'draft', title: 'My version', adaptation: { sourceRecipeId: recipe.id } }, { recipeId: 'local-copy' });
  assert.equal(adapted.recipeId, 'local-copy'); assert.equal(adapted.sourceRecipeId, recipe.id);
});

test('default completion timestamps reset after the workstation clock moves back', () => {
  const original = Date.now;
  try {
    Date.now = () => Date.parse('2026-10-25T12:00:00.000Z');
    createBakeCompletion({ ...recipe, id: 'clock-correction' });
    Date.now = () => Date.parse('2026-10-24T12:00:00.000Z');
    const corrected = createBakeCompletion({ ...recipe, id: 'clock-correction' });
    assert.equal(corrected.completedAt, '2026-10-24T12:00:00.000Z');
  } finally { Date.now = original; }
});

test('event validation rejects malformed IDs, timestamps and recipe snapshots', () => {
  const valid = event('valid');
  for (const patch of [{ id: 'invalid/path' }, { completedAt: 'bad' }, { deletedAt: 'bad' }, { title: '' }, { difficulty: 'Expert' }, { recipeId: '' }]) assert.equal(isBakeCompletion({ ...valid, ...patch }), false);
  assert.equal(isBakeCompletion(null), false);
});

test('completion merge retains repeated bakes but ignores echoes and never mutates input', () => {
  const first = event('first'), second = event('second', '2026-10-25T12:00:00.000Z');
  const input = structuredClone([first, second]);
  assert.deepEqual(mergeBakeCompletions([second], [first, second, null]), input);
  assert.deepEqual([first, second], input);
});

test('completion tombstones survive stale echoes in either merge order', () => {
  const original = event('removed'), removed = { ...original, deletedAt: '2026-10-25T12:00:00.000Z' };
  assert.deepEqual(mergeBakeCompletions([original], [removed]), [removed]);
  assert.deepEqual(mergeBakeCompletions([removed], [original]), [removed]);
  const newer = { ...removed, deletedAt: '2026-10-26T12:00:00.000Z' };
  assert.deepEqual(mergeBakeCompletions([newer], [removed]), [newer]);
});

test('favorite state is monotonic for rapid toggles and stale snapshots cannot resurrect stars', () => {
  const first = nextFavoriteState(undefined, true, '2026-10-24T12:00:00.000Z');
  const second = nextFavoriteState(first, false, first.updatedAt);
  const third = nextFavoriteState(second, true, first.updatedAt);
  assert.ok(first.updatedAt < second.updatedAt && second.updatedAt < third.updatedAt);
  assert.deepEqual(mergeRecipeFavorites({ x: second }, { x: first }), { x: second });
  assert.deepEqual(mergeRecipeFavorites({ x: first }, { x: { ...first, favorite: false } }), { x: { ...first, favorite: false } });
});

test('favorites validate entries and safely support arbitrary recipe keys', () => {
  const star = nextFavoriteState(undefined, true);
  const input = JSON.parse(JSON.stringify({ '__proto__': 'ignored' }));
  Object.defineProperty(input, '__proto__', { value: star, enumerable: true });
  const merged = mergeRecipeFavorites(input, { bad: { favorite: true, updatedAt: 'bad' }, empty: null });
  assert.ok(Object.hasOwn(merged, '__proto__')); assert.deepEqual(merged.__proto__, star);
  assert.deepEqual(Object.keys(merged), ['__proto__']);
});

test('legacy migration records only the known latest completion with stable IDs', () => {
  const progress = { [recipe.id]: { completedAt: '2026-10-24T12:00:00.000Z' }, unknown: { completedAt: '2026-10-10' } };
  const first = migrateLegacyCompletions(progress, [recipe]);
  assert.equal(first.length, 1); assert.equal(first[0].completedAt, progress[recipe.id].completedAt);
  assert.deepEqual(migrateLegacyCompletions(progress, [recipe]), first);
  assert.equal(first[0].id, completionId(recipe.id, first[0].completedAt));
  const actual = createBakeCompletion({ ...recipe, title: 'My actual baked version' }, { completedAt: first[0].completedAt });
  assert.equal(actual.id, first[0].id);
  assert.deepEqual(mergeBakeCompletions(first, [actual]), [actual]);
  assert.deepEqual(mergeBakeCompletions([actual], first), [actual]);
});

test('local activity is account-isolated and corrupt storage safely recovers', () => withStorage(values => {
  persistBakeActivity(null, activity([event('guest')]));
  persistBakeActivity('alice', activity([event('alice')]));
  assert.equal(loadBakeActivity(null).completions[0].id, 'guest');
  assert.equal(loadBakeActivity('alice').completions[0].id, 'alice');
  assert.deepEqual(loadBakeActivity('bob'), activity());
  values.set(bakeActivityKey, '{broken'); assert.deepEqual(loadBakeActivity('alice'), activity());
}));

test('guest claim moves history once atomically and never copies it to another account', () => withStorage(values => {
  const guest = event('guest'), alice = event('alice');
  persistBakeActivity(null, activity([guest])); persistBakeActivity('alice', activity([alice]));
  assert.equal(claimGuestBakeActivity('alice').completions.length, 2);
  assert.deepEqual(loadBakeActivity(null), activity());
  assert.deepEqual(claimGuestBakeActivity('bob'), activity());
  assert.equal(loadBakeActivity('alice').completions.length, 2);
  const envelope = JSON.parse(values.get(bakeActivityKey)); assert.equal(envelope.guestClaimedBy, 'alice');
  persistBakeActivity(null, activity([event('later-guest')]));
  assert.deepEqual(claimGuestBakeActivity('bob'), activity());
  assert.equal(loadBakeActivity(null).completions.length, 1);
  assert.equal(claimGuestBakeActivity('alice').completions.length, 3);
  assert.deepEqual(loadBakeActivity(null), activity());
}));

test('failed guest claim leaves guest data and marker untouched', () => withStorage(values => {
  persistBakeActivity(null, activity([event('guest')])); const previous = values.get(bakeActivityKey);
  globalThis.localStorage.setItem = () => { throw new Error('full'); };
  assert.throws(() => claimGuestBakeActivity('alice'), /full/);
  assert.equal(values.get(bakeActivityKey), previous); assert.equal(loadBakeActivity(null).completions.length, 1);
  assert.deepEqual(loadBakeActivity('alice'), activity());
}));

test('legacy migration markers are owner-specific and do not invent later repeats', () => withStorage(() => {
  const progress = { [recipe.id]: { completedAt: '2026-10-24T12:00:00.000Z' } };
  const migrated = migrateLegacyBakeActivity(null, progress, [recipe]);
  assert.equal(migrated.completions.length, 1);
  assert.deepEqual(migrateLegacyBakeActivity(null, { [recipe.id]: { completedAt: '2026-10-25T12:00:00.000Z' } }, [recipe]), migrated);
  claimGuestBakeActivity('alice');
  const bobProgress = { [recipe.id]: { completedAt: '2026-10-23T12:00:00.000Z' } };
  const bob = migrateLegacyBakeActivity('bob', bobProgress, [recipe]);
  assert.equal(bob.completions.length, 1); assert.equal(bob.completions[0].completedAt, bobProgress[recipe.id].completedAt);
  assert.notEqual(bob.completions[0].id, migrated.completions[0].id);
}));

test('analytics zero-fills local days and stacks difficulty with a cumulative line', () => {
  const events = [event('a', '2026-10-23T12:00:00.000Z'), event('b', '2026-10-23T13:00:00.000Z', { difficulty: 'Experienced' }), event('c', '2026-10-25T12:00:00.000Z')];
  const result = buildBakeAnalytics(events, { metric: 'difficulty', interval: 'day', rangeDays: 3, now: '2026-10-25T23:59:00.000Z' });
  assert.equal(result.buckets.length, 3); assert.deepEqual(result.buckets.map(b => b.total), [2, 0, 1]);
  assert.deepEqual(result.buckets.map(b => b.cumulative), [2, 2, 3]);
  assert.equal(result.buckets[0].values.Novice, 1); assert.equal(result.buckets[0].values.Experienced, 1);
});

test('weekly and monthly analytics cross calendar boundaries without dropping counts', () => {
  const events = [event('a', '2026-09-30T12:00:00.000Z'), event('b', '2026-10-01T12:00:00.000Z')];
  const months = buildBakeAnalytics(events, { metric: 'total', interval: 'month', rangeDays: null, now: '2026-10-25T23:59:00.000Z' });
  assert.deepEqual(months.buckets.map(b => b.total), [1, 1]);
  const weeks = buildBakeAnalytics(events, { metric: 'total', interval: 'week', rangeDays: null, now: '2026-10-25T23:59:00.000Z' });
  assert.equal(weeks.buckets.reduce((sum, b) => sum + b.total, 0), 2);
  assert.ok(weeks.buckets.every(b => new Date(b.start).getDay() === 1));
});

test('unique analytics count repeat days separately but cumulative distinct recipes once', () => {
  const events = [event('a', '2026-10-24T12:00:00.000Z'), event('b', '2026-10-24T13:00:00.000Z'), event('c', '2026-10-25T12:00:00.000Z'), event('d', '2026-10-25T13:00:00.000Z', { recipeId: 'cake' })];
  const result = buildBakeAnalytics(events, { metric: 'unique', interval: 'day', rangeDays: 2, now: '2026-10-25T23:59:00.000Z' });
  assert.deepEqual(result.buckets.map(b => b.total), [1, 2]); assert.deepEqual(result.buckets.map(b => b.cumulative), [1, 2]);
  assert.equal(result.totalCompletions, 4); assert.equal(result.uniqueRecipes, 2);
});

test('analytics excludes deleted, future and out-of-range bakes and filters category', () => {
  const events = [event('a'), event('b', '2026-10-24T13:00:00.000Z', { category: 'Cakes' }), event('deleted', '2026-10-24T14:00:00.000Z', { deletedAt: '2026-10-25T10:00:00.000Z' }), event('future', '2026-11-01T12:00:00.000Z'), event('old', '2025-01-01T12:00:00.000Z')];
  const result = buildBakeAnalytics(events, { metric: 'category', interval: 'day', category: 'Cookies', rangeDays: 30, now: '2026-10-25T23:59:00.000Z' });
  assert.equal(result.totalCompletions, 1); assert.deepEqual(result.seriesKeys, ['Cookies']); assert.deepEqual(result.categories, ['Cakes', 'Cookies']);
});

let adapterSequence = 0;
async function loadCloudAdapter() {
  const key = `__bakeFirestoreTest${++adapterSequence}`;
  const state = { db: { path: '' }, documents: new Map(), listeners: [], reads: [], writes: [], denyReads: new Set(), denyWrites: new Set() };
  globalThis[key] = state;
  const stub = `
    const state = globalThis[${JSON.stringify(key)}];
    const copy = value => value === undefined ? undefined : structuredClone(value);
    const plain = value => value && typeof value === 'object' && !Array.isArray(value);
    const merge = (before, next) => {
      const result = { ...(before ?? {}) };
      for (const [key, value] of Object.entries(next)) Object.defineProperty(result, key, { value: plain(value) && plain(result[key]) ? merge(result[key], value) : copy(value), enumerable: true, configurable: true, writable: true });
      return result;
    };
    const denied = (paths, path) => [...paths].some(prefix => path === prefix || path.startsWith(prefix + '/'));
    const permission = () => Object.assign(new Error('Denied by fixture rules'), { code: 'permission-denied' });
    const reference = (parent, parts, kind) => ({ path: [parent.path, ...parts].filter(Boolean).join('/'), kind });
    export const doc = (parent, ...parts) => reference(parent, parts, 'document');
    export const collection = (parent, ...parts) => reference(parent, parts, 'collection');
    export const serverTimestamp = () => ({ fixtureServerTime: true });
    export function onSnapshot(reference, options, callback, error) {
      const listener = { reference, options, callback, error, active: true }; state.listeners.push(listener);
      return () => { listener.active = false; };
    }
    export async function setDoc(reference, value, options) {
      if (denied(state.denyWrites, reference.path)) throw permission();
      state.documents.set(reference.path, options?.merge ? merge(state.documents.get(reference.path), value) : copy(value));
    }
    export async function runTransaction(_db, callback) {
      const pending = [];
      const result = await callback({
        async get(reference) {
          state.reads.push(reference.path);
          if (denied(state.denyReads, reference.path)) throw permission();
          const value = copy(state.documents.get(reference.path));
          return { data: () => value };
        },
        set(reference, value, options) { pending.push({ reference, value: copy(value), options }); },
      });
      for (const write of pending) if (denied(state.denyWrites, write.reference.path)) throw permission();
      for (const write of pending) {
        state.writes.push(write.reference.path);
        state.documents.set(write.reference.path, write.options?.merge ? merge(state.documents.get(write.reference.path), write.value) : write.value);
      }
      return result;
    }
  `;
  const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const firestoreUrl = moduleUrl(stub), firebaseUrl = moduleUrl(`export const firestore = globalThis[${JSON.stringify(key)}].db;`);
  const source = await readFile(new URL('../src/progressStore.ts', import.meta.url), 'utf8');
  const transformed = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/from ["']firebase\/firestore["']/g, `from ${JSON.stringify(firestoreUrl)}`)
    .replace(/from ["']\.\/firebase["']/g, `from ${JSON.stringify(firebaseUrl)}`)
    .replace(/from ["']\.\.\/shared\/bake-history\.mjs["']/g, `from ${JSON.stringify(new URL('../shared/bake-history.mjs', import.meta.url).href)}`);
  const adapter = await import(moduleUrl(transformed + `\n// ${key}`));
  const listener = path => state.listeners.find(value => value.reference.path === path);
  const emit = (path, data, fromCache = false) => {
    const target = listener(path);
    const snapshot = target.reference.kind === 'collection' ? { docs: (data ?? []).map(value => ({ data: () => value })), metadata: { fromCache } } : { data: () => data, metadata: { fromCache } };
    target.callback(snapshot);
  };
  return { adapter, state, listener, emit, cleanup: () => { delete globalThis[key]; } };
}

test('cloud adapter waits for all snapshots, exposes cache metadata and ignores late callbacks', async () => {
  const fixture = await loadCloudAdapter();
  try {
    const changes = [], errors = [];
    const unsubscribe = fixture.adapter.subscribeToBakeActivity('alice', (value, metadata) => changes.push({ value, metadata }), () => errors.push(true));
    assert.equal(fixture.state.listeners.length, 3);
    assert.ok(fixture.state.listeners.every(value => value.options.includeMetadataChanges));
    fixture.emit('bakingProfiles/alice', { bakeActivity: { completionsById: { legacy: event('legacy') } } }, true);
    fixture.emit('bakingProfiles/alice/completions', [event('second')], false);
    assert.equal(changes.length, 0);
    fixture.emit('bakingProfiles/alice/favorites', [{ recipeId: 'snickerdoodle', ...nextFavoriteState(undefined, true) }], false);
    assert.equal(changes.length, 1); assert.equal(changes[0].value.completions.length, 2); assert.equal(changes[0].metadata.fromCache, true);
    fixture.emit('bakingProfiles/alice', { bakeActivity: { completionsById: { legacy: event('legacy') } } }, false);
    assert.equal(changes.at(-1).metadata.fromCache, false);
    unsubscribe(); assert.ok(fixture.state.listeners.every(value => !value.active));
    const count = changes.length; fixture.emit('bakingProfiles/alice/completions', [event('late')]); assert.equal(changes.length, count);
    assert.deepEqual(errors, []);
  } finally { fixture.cleanup(); }
});

test('cloud permission fallback merges per-ID maps without overwriting progress or other bakes', async () => {
  const fixture = await loadCloudAdapter();
  try {
    const path = 'bakingProfiles/alice', changes = [], errors = [];
    fixture.state.documents.set(path, { progressByRecipe: { cake: { completedAt: '2026-10-20' } } });
    const unsubscribe = fixture.adapter.subscribeToBakeActivity('alice', (value, metadata) => changes.push({ value, metadata }), () => errors.push(true));
    fixture.emit(path, fixture.state.documents.get(path));
    const denial = Object.assign(new Error('Fixture legacy rules'), { code: 'permission-denied' });
    fixture.listener(`${path}/completions`).error(denial); fixture.listener(`${path}/favorites`).error(denial);
    assert.equal(changes.length, 1); assert.equal(changes[0].metadata.fromCache, false); assert.deepEqual(errors, []);
    await Promise.all([fixture.adapter.saveBakeCompletion('alice', event('one')), fixture.adapter.saveBakeCompletion('alice', event('two'))]);
    await fixture.adapter.saveRecipeFavorite('alice', 'local:recipe.with.dots', nextFavoriteState(undefined, true));
    const stored = fixture.state.documents.get(path);
    assert.deepEqual(stored.progressByRecipe, { cake: { completedAt: '2026-10-20' } });
    assert.deepEqual(Object.keys(stored.bakeActivity.completionsById).sort(), ['one', 'two']);
    assert.equal(stored.bakeActivity.favoritesByRecipe['local%3Arecipe.with.dots'].recipeId, 'local:recipe.with.dots');
    assert.ok(fixture.state.reads.every(value => value === path));
    fixture.emit(path, stored); assert.equal(changes.at(-1).value.favorites['local:recipe.with.dots'].favorite, true);
    unsubscribe();
  } finally { fixture.cleanup(); }
});

test('cloud favorite transactions reject a delayed older toggle in both storage modes', async () => {
  for (const fallback of [false, true]) {
    const fixture = await loadCloudAdapter();
    try {
      if (fallback) fixture.state.denyWrites.add('bakingProfiles/alice/favorites');
      const first = nextFavoriteState(undefined, true, '2026-10-24T12:00:00.000Z'), second = nextFavoriteState(first, false, first.updatedAt);
      await fixture.adapter.saveRecipeFavorite('alice', 'snickerdoodle', second);
      await fixture.adapter.saveRecipeFavorite('alice', 'snickerdoodle', first);
      const stored = fixture.state.documents.get(fallback ? 'bakingProfiles/alice' : 'bakingProfiles/alice/favorites/snickerdoodle');
      assert.equal((fallback ? stored.bakeActivity.favoritesByRecipe.snickerdoodle : stored).favorite, false);
    } finally { fixture.cleanup(); }
  }
});

test('cloud completion retries preserve deletion markers and prefer actual snapshots over legacy', async () => {
  for (const fallback of [false, true]) {
    const fixture = await loadCloudAdapter();
    try {
      if (fallback) fixture.state.denyWrites.add('bakingProfiles/alice/completions');
      const legacy = { ...event('history'), legacy: true }, actual = { ...event('history'), title: 'Actual recipe baked' }, removed = { ...actual, deletedAt: '2026-10-25T12:00:00.000Z' };
      await fixture.adapter.saveBakeCompletion('alice', legacy);
      await fixture.adapter.saveBakeCompletion('alice', actual);
      await fixture.adapter.saveBakeCompletion('alice', removed);
      await fixture.adapter.saveBakeCompletion('alice', legacy);
      const raw = fixture.state.documents.get(fallback ? 'bakingProfiles/alice' : 'bakingProfiles/alice/completions/history');
      const stored = fallback ? raw.bakeActivity.completionsById.history : raw;
      assert.equal(stored.title, actual.title); assert.equal(stored.deletedAt, removed.deletedAt); assert.equal(stored.legacy, false);
    } finally { fixture.cleanup(); }
  }
});

test('preferred cloud collections append separate documents and expose real errors', async () => {
  const fixture = await loadCloudAdapter();
  try {
    await fixture.adapter.saveBakeCompletion('alice', event('first'));
    await fixture.adapter.saveBakeCompletion('alice', event('second'));
    assert.ok(fixture.state.documents.has('bakingProfiles/alice/completions/first'));
    assert.ok(fixture.state.documents.has('bakingProfiles/alice/completions/second'));
    assert.equal(fixture.state.documents.has('bakingProfiles/alice'), false);
    const errors = [];
    const unsubscribe = fixture.adapter.subscribeToBakeActivity('alice', () => {}, () => errors.push(true));
    fixture.listener('bakingProfiles/alice/completions').error(Object.assign(new Error('offline'), { code: 'unavailable' }));
    assert.equal(errors.length, 1); unsubscribe();
  } finally { fixture.cleanup(); }
});

test('fatal cloud listener errors latch until retry and cannot be masked by other snapshots', async () => {
  const fixture = await loadCloudAdapter();
  try {
    const changes = [], errors = [];
    const unsubscribe = fixture.adapter.subscribeToBakeActivity('alice', value => changes.push(value), () => errors.push(true));
    fixture.emit('bakingProfiles/alice', {});
    fixture.emit('bakingProfiles/alice/completions', [event('first')]);
    fixture.emit('bakingProfiles/alice/favorites', []);
    assert.equal(changes.length, 1);
    fixture.listener('bakingProfiles/alice/completions').error(Object.assign(new Error('listener ended'), { code: 'unavailable' }));
    assert.equal(errors.length, 1);
    fixture.emit('bakingProfiles/alice', { bakeActivity: { completionsById: { later: event('later') } } });
    fixture.emit('bakingProfiles/alice/favorites', [{ recipeId: recipe.id, ...nextFavoriteState(undefined, true) }]);
    fixture.listener('bakingProfiles/alice/favorites').error(Object.assign(new Error('second ended'), { code: 'unavailable' }));
    assert.equal(changes.length, 1); assert.equal(errors.length, 1);
    unsubscribe();
    const retried = [];
    const retry = fixture.adapter.subscribeToBakeActivity('alice', value => retried.push(value), () => errors.push(true));
    const fresh = fixture.state.listeners.slice(-3);
    fresh[0].callback({ data: () => ({}), metadata: { fromCache: false } });
    fresh[1].callback({ docs: [], metadata: { fromCache: false } });
    fresh[2].callback({ docs: [], metadata: { fromCache: false } });
    assert.equal(retried.length, 1); retry();
  } finally { fixture.cleanup(); }
});
