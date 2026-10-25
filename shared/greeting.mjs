/** Keep the baker's spelling while normalizing accidental whitespace. */
export function normalizeFirstName(value) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/gu, ' ').trim();
  return Array.from(clean).slice(0, 60).join('');
}

/** A null greeting lets a first-time guest see the original introduction. */
export function greeting({ firstName, signedIn = false } = {}) {
  const name = normalizeFirstName(firstName);
  if (name) return `Welcome back, ${name}!`;
  return signedIn === true ? 'Welcome back!' : null;
}
