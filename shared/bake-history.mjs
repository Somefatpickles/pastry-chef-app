const levels = ['Novice', 'Intermediate', 'Experienced', 'Challenges'];
const text = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
const validText = (value, max = 400) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const validStamp = value => typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
const stamp = value => new Date(value).toISOString();
const latestGeneratedStamp = new Map();

export function isBakeCompletion(value) {
  return !!value && typeof value === 'object' && typeof value.id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value.id)
    && validText(value.recipeId, 500) && validText(value.sourceRecipeId, 160) && validText(value.title, 240)
    && levels.includes(value.difficulty) && validText(value.category, 200) && validStamp(value.completedAt)
    && (value.deletedAt === undefined || validStamp(value.deletedAt))
    && (value.legacy === undefined || typeof value.legacy === 'boolean');
}

export function createBakeCompletion(recipe, options = {}) {
  const recipeId = options.recipeId ?? recipe.id;
  const now = Date.now(), previous = latestGeneratedStamp.get(recipeId);
  // Reset after a wall-clock correction; rapid same-millisecond calls still
  // receive separate stamps without carrying an old clock's future into today.
  const completedTime = options.completedAt ?? (previous && now >= previous.wallTime ? Math.max(now, previous.generatedTime + 1) : now);
  const completedAt = stamp(completedTime);
  if (options.completedAt === undefined) latestGeneratedStamp.set(recipeId, { wallTime: now, generatedTime: Date.parse(completedAt) });
  const completion = {
    id: options.id ?? completionId(recipeId, completedAt), recipeId,
    sourceRecipeId: recipe.adaptation?.sourceRecipeId ?? recipe.sourceRecipeId ?? recipe.id,
    title: recipe.title, difficulty: recipe.difficulty, category: text(recipe.category) || 'Custom',
    completedAt,
  };
  if (!isBakeCompletion(completion)) throw new Error('The bake completion is incomplete.');
  return completion;
}

function cleanCompletion(value) {
  return { id: value.id, recipeId: value.recipeId, sourceRecipeId: value.sourceRecipeId, title: value.title,
    difficulty: value.difficulty, category: value.category, completedAt: stamp(value.completedAt),
    ...(value.deletedAt ? { deletedAt: stamp(value.deletedAt) } : {}), ...(value.legacy === true ? { legacy: true } : {}) };
}

/** Immutable event union; a deletion always survives old realtime/cache echoes. */
export function mergeBakeCompletions(...collections) {
  const events = new Map();
  for (const values of collections) {
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (!isBakeCompletion(value)) continue;
      const next = cleanCompletion(value), before = events.get(next.id);
      if (!before) { events.set(next.id, next); continue; }
      const base = before.legacy !== next.legacy ? (before.legacy ? next : before) : JSON.stringify({ ...before, deletedAt: undefined }) <= JSON.stringify({ ...next, deletedAt: undefined }) ? before : next;
      const deletedAt = [before.deletedAt, next.deletedAt].filter(Boolean).sort().at(-1);
      events.set(next.id, { ...base, ...(deletedAt ? { deletedAt } : {}) });
    }
  }
  return [...events.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
}

export function isFavoriteState(value) {
  return !!value && typeof value === 'object' && typeof value.favorite === 'boolean' && validStamp(value.updatedAt);
}

export function nextFavoriteState(current, favorite, now = Date.now()) {
  const currentTime = isFavoriteState(current) ? Date.parse(current.updatedAt) : -Infinity;
  const proposed = new Date(now).getTime();
  if (!Number.isFinite(proposed)) throw new Error('Choose a valid favorite date.');
  return { favorite: Boolean(favorite), updatedAt: stamp(Math.max(proposed, currentTime + 1)) };
}

/** False favorites are tombstones, preventing stale snapshots from re-starring. */
export function mergeRecipeFavorites(...collections) {
  const favorites = {};
  for (const values of collections) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
    for (const [id, value] of Object.entries(values)) {
      if (!validText(id, 500) || !isFavoriteState(value)) continue;
      const next = { favorite: value.favorite, updatedAt: stamp(value.updatedAt) }, before = Object.hasOwn(favorites, id) ? favorites[id] : undefined;
      if (!before || next.updatedAt > before.updatedAt || (next.updatedAt === before.updatedAt && !next.favorite)) {
        Object.defineProperty(favorites, id, { value: next, enumerable: true, writable: true, configurable: true });
      }
    }
  }
  return favorites;
}

export function normalizeBakeActivity(value) {
  return { completions: mergeBakeCompletions(value?.completions), favorites: mergeRecipeFavorites(value?.favorites) };
}

export function mergeBakeActivity(...activities) {
  return { completions: mergeBakeCompletions(...activities.map(value => value?.completions)), favorites: mergeRecipeFavorites(...activities.map(value => value?.favorites)) };
}

function hashedId(value) {
  // Two independent 32-bit hashes make deterministic, Firestore-safe legacy IDs.
  let first = 2166136261, second = 2246822519;
  for (const character of value) {
    const code = character.codePointAt(0);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ code, 3266489917) >>> 0;
  }
  return `bake-${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

export function completionId(recipeId, completedAt) { return hashedId(`${recipeId}\n${stamp(completedAt)}`); }

/** Only the one timestamp actually retained by the old model can be migrated. */
export function migrateLegacyCompletions(progress, recipes) {
  return recipes.flatMap(recipe => {
    const completedAt = progress?.[recipe.id]?.completedAt;
    if (!validStamp(completedAt)) return [];
    const normalized = stamp(completedAt);
    return [{ ...createBakeCompletion(recipe, { completedAt: normalized }), legacy: true }];
  });
}

const dayStart = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const localDayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function periodStart(value, interval) {
  const date = dayStart(value);
  if (interval === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  if (interval === 'month') date.setDate(1);
  return date;
}
function nextPeriod(value, interval) {
  const date = new Date(value);
  if (interval === 'month') date.setMonth(date.getMonth() + 1);
  else date.setDate(date.getDate() + (interval === 'week' ? 7 : 1));
  return date;
}

/** Zero-filled local-calendar buckets, with cumulative totals within the view. */
export function buildBakeAnalytics(values, options = {}) {
  const now = new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error('Choose a valid analytics date.');
  const interval = ['day', 'week', 'month'].includes(options.interval) ? options.interval : 'week';
  const metric = ['total', 'difficulty', 'category', 'unique'].includes(options.metric) ? options.metric : 'difficulty';
  const all = mergeBakeCompletions(values).filter(event => !event.deletedAt && Date.parse(event.completedAt) <= now.getTime());
  const categories = [...new Set(all.map(event => event.category))].sort((a, b) => a.localeCompare(b));
  const matching = all.filter(event => !options.category || options.category === 'All categories' || event.category === options.category);
  const rangeDays = options.rangeDays === null ? null : Number.isFinite(options.rangeDays) ? Math.max(1, Math.min(3660, Math.floor(options.rangeDays))) : 90;
  const start = dayStart(now);
  if (rangeDays === null) {
    if (matching.length) start.setTime(dayStart(new Date(matching[0].completedAt)).getTime());
  } else start.setDate(start.getDate() - rangeDays + 1);
  const selected = matching.filter(event => Date.parse(event.completedAt) >= start.getTime());
  const seriesKeys = metric === 'difficulty' ? [...levels] : metric === 'category' ? [...new Set(selected.map(event => event.category))].sort((a, b) => a.localeCompare(b)) : [metric === 'unique' ? 'Distinct recipes' : 'Completed'];
  const buckets = [], bucketMap = new Map();
  for (let current = periodStart(start, interval); current.getTime() <= now.getTime(); current = nextPeriod(current, interval)) {
    const end = nextPeriod(current, interval), key = localDayKey(current);
    const label = interval === 'month' ? current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${interval === 'week' ? ' week' : ''}`;
    const bucket = { key, label, start: current.toISOString(), end: end.toISOString(), total: 0, cumulative: 0, values: Object.fromEntries(seriesKeys.map(series => [series, 0])) };
    buckets.push(bucket); bucketMap.set(key, bucket);
  }
  const distinctPerBucket = new Map(), cumulativeRecipes = new Set();
  for (const event of selected) {
    const key = localDayKey(periodStart(new Date(event.completedAt), interval));
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    const series = metric === 'difficulty' ? event.difficulty : metric === 'category' ? event.category : metric === 'unique' ? 'Distinct recipes' : 'Completed';
    if (metric === 'unique') {
      const ids = distinctPerBucket.get(key) ?? new Set();
      if (ids.has(event.recipeId)) continue;
      ids.add(event.recipeId); distinctPerBucket.set(key, ids);
    }
    bucket.total++; bucket.values[series] = (bucket.values[series] ?? 0) + 1;
  }
  let cumulative = 0;
  for (const bucket of buckets) {
    if (metric === 'unique') {
      for (const id of distinctPerBucket.get(bucket.key) ?? []) cumulativeRecipes.add(id);
      bucket.cumulative = cumulativeRecipes.size;
    } else { cumulative += bucket.total; bucket.cumulative = cumulative; }
  }
  return { buckets, seriesKeys, totalCompletions: selected.length, uniqueRecipes: new Set(selected.map(event => event.recipeId)).size, categories, rangeStart: start.toISOString(), rangeEnd: now.toISOString() };
}
