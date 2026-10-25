import { normalizeFirstName } from '../shared/greeting.mjs';

export { normalizeFirstName } from '../shared/greeting.mjs';

type StoredName = { version: 1; firstName: string };

/** Guest names and each signed-in baker are separate browser records. */
export function firstNameStorageKey(userId?: string | null): string {
  const identity = userId;
  return `pastry-chef.first-name.v1:${identity ? `user:${encodeURIComponent(identity)}` : 'guest'}`;
}

function readStoredName(userId?: string | null): StoredName | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(firstNameStorageKey(userId)) ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (record.version !== 1 || typeof record.firstName !== 'string') return null;
    return { version: 1, firstName: normalizeFirstName(record.firstName) };
  } catch { return null; }
}

export function loadFirstName(userId?: string | null): string {
  return readStoredName(userId)?.firstName ?? '';
}

/** A stored empty string is an intentional clear, not a missing profile value. */
export function hasFirstNameEntry(userId?: string | null): boolean {
  return readStoredName(userId) !== null;
}

/** Storage errors propagate so the caller never reports an unsuccessful save. */
export function saveFirstName(name: unknown, userId?: string | null): string {
  const firstName = normalizeFirstName(name);
  localStorage.setItem(firstNameStorageKey(userId), JSON.stringify({ version: 1, firstName } satisfies StoredName));
  return firstName;
}
