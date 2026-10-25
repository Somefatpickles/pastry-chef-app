export class ChefSessionEndedError extends Error {}
export function hasChefAccount(user: { isAnonymous: boolean; email: string | null; providerData: readonly { providerId: string }[] } | null | undefined): boolean;
export function requestChefWithSession(options: {
  user: { getIdToken: (forceRefresh?: boolean) => Promise<string> };
  payload: unknown;
  isCurrent: () => boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<Response>;
