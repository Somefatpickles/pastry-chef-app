export class ChefSessionEndedError extends Error {
  constructor() { super('Your chef session has ended.'); this.name = 'ChefSessionEndedError'; }
}

export function hasChefAccount(user) {
  return Boolean(user && !user.isAnonymous && typeof user.email === 'string' && user.email.trim() && Array.isArray(user.providerData) && user.providerData.some(provider => provider?.providerId === 'password'));
}

/** Only the current account may submit, including after token refresh or sign-out. */
export async function requestChefWithSession({ user, payload, isCurrent, signal, fetchImpl = fetch }) {
  const checkSession = () => {
    if (signal?.aborted || !isCurrent()) throw new ChefSessionEndedError();
  };
  checkSession();
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await user.getIdToken(attempt === 1);
    checkSession();
    if (typeof token !== 'string' || !token.trim()) throw new ChefSessionEndedError();
    const response = await fetchImpl('/api/chef', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal,
    });
    checkSession();
    if (response.status !== 401 || attempt === 1) return response;
  }
  throw new ChefSessionEndedError();
}
