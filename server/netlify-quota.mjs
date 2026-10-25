import { createHash } from 'node:crypto';
import { ChefError } from './chef.mjs';

export const quotaStoreName = 'crumbcraft-chef-usage';
const busy = () => new ChefError(429, 'The chef has reached its request limit. Please wait a little and try again.');
const unavailable = () => new ChefError(503, 'The chef could not check its usage limits. Please try again later.');

async function claimSlot(store, prefix, limit, expiresAt, signal) {
  for (let slot = 0; slot < limit; slot++) {
    if (signal?.aborted) throw unavailable();
    const result = await store.set(`${prefix}/${slot}`, '1', { onlyIfNew: true, metadata: { expiresAt } });
    if (signal?.aborted) throw unavailable();
    if (!result || typeof result.modified !== 'boolean') throw unavailable();
    if (result.modified) {
      // A real successful conditional write includes an ETag. Never accept a
      // storage error disguised as an empty conditional-write success.
      if (typeof result.etag !== 'string' || !result.etag) throw unavailable();
      return;
    }
  }
  throw busy();
}

/** Claim unique keys rather than racing read/modify/write blob counters. */
export async function reserveChefQuota(store, uid, { now = Date.now(), signal } = {}) {
  if (!store || typeof store.set !== 'function' || typeof uid !== 'string' || !uid || !Number.isFinite(now)) throw unavailable();
  const userBucket = Math.floor(now / 600000), globalBucket = Math.floor(now / 3600000);
  const user = createHash('sha256').update(uid).digest('hex');
  try {
    // Time first keeps expired claims together during bounded listing cleanup.
    await claimSlot(store, `v1/u/${userBucket}/${user}`, 8, (userBucket + 1) * 600000, signal);
    await claimSlot(store, `v1/g/${globalBucket}`, 60, (globalBucket + 1) * 3600000, signal);
  } catch (error) { throw error instanceof ChefError ? error : unavailable(); }
}

function expiredClaim(key, now) {
  const user = /^v1\/u\/(\d+)\/[a-f0-9]{64}\/\d+$/.exec(key);
  const global = /^v1\/g\/(\d+)\/\d+$/.exec(key);
  const match = user ?? global;
  return Boolean(match && (Number(match[1]) + 1) * (user ? 600000 : 3600000) < now - 48 * 3600000);
}

/** Keep cleanup bounded; only this store's old, known-format claim keys qualify. */
export async function cleanupChefQuota(store, { now = Date.now(), maxEntries = 1000, maxPages = 5 } = {}) {
  let pages = 0, removed = 0;
  for await (const page of store.list({ paginate: true })) {
    if (++pages > maxPages) break;
    const keys = page.blobs.map(blob => blob.key).filter(key => expiredClaim(key, now)).slice(0, maxEntries - removed);
    for (let index = 0; index < keys.length; index += 10) {
      const results = await Promise.allSettled(keys.slice(index, index + 10).map(key => store.delete(key)));
      if (results.some(result => result.status === 'rejected')) throw unavailable();
      removed += results.length;
    }
    if (removed >= maxEntries) break;
  }
  return { removed };
}
