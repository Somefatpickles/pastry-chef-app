export class BakerAuthError extends Error {
  constructor(status, message) { super(message); this.name = 'BakerAuthError'; this.status = status; }
}

const signInMessage = 'Sign in with your email and password to use the AI Pastry Chef.';
const unavailableMessage = 'Sign-in verification is temporarily unavailable. Please try again.';

export function readBakerToken(authorization) {
  if (typeof authorization !== 'string' || authorization.length > 8192) throw new BakerAuthError(401, signInMessage);
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
  if (!match) throw new BakerAuthError(401, signInMessage);
  return match[1];
}

/** Firebase's account lookup validates the token; local claims only reject early. */
export async function verifyBakerLogin(authorization, { apiKey, projectId, fetchImpl = fetch, nowSeconds = () => Date.now() / 1000 } = {}) {
  const token = readBakerToken(authorization);
  if (!apiKey || !projectId) throw new BakerAuthError(503, unavailableMessage);
  let claims;
  try {
    const [encodedHeader, encodedClaims] = token.split('.');
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));
    const now = nowSeconds();
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 || !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 || !Number.isFinite(claims.auth_time) || claims.auth_time > now + 60) throw new Error('Invalid claims');
  } catch { throw new BakerAuthError(401, signInMessage); }

  let response;
  let data;
  try {
    response = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10000),
    });
    data = await response.json();
  } catch { throw new BakerAuthError(503, unavailableMessage); }
  if (!response.ok) {
    const code = data?.error?.message ?? '';
    if (response.status === 400 && /^(INVALID_ID_TOKEN|TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|CREDENTIAL_MISMATCH)(?:\b|$)/.test(code)) throw new BakerAuthError(401, signInMessage);
    throw new BakerAuthError(503, unavailableMessage);
  }
  const account = data?.users?.length === 1 ? data.users[0] : null;
  if (!account || account.localId !== claims.sub || account.disabled === true) throw new BakerAuthError(401, signInMessage);
  if (typeof account.email !== 'string' || !account.email.trim() || !Array.isArray(account.providerUserInfo) || !account.providerUserInfo.some(provider => provider?.providerId === 'password')) throw new BakerAuthError(403, signInMessage);
  return { uid: account.localId, email: account.email };
}

/** Keep authorization and recipe generation in one testable boundary. */
export async function runBakerChef(authorization, payload, catalog, { authConfig, verify = verifyBakerLogin, adapt } = {}) {
  await verify(authorization, authConfig);
  return adapt(payload, catalog);
}
