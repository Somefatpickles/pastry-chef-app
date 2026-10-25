import { getStore } from '@netlify/blobs';
import { cleanupChefQuota, quotaStoreName } from '../../server/netlify-quota.mjs';

export default async () => {
  try { return Response.json(await cleanupChefQuota(getStore({ name: quotaStoreName, consistency: 'strong' }))); }
  catch { return Response.json({ error: 'Usage record cleanup could not finish.' }, { status: 503 }); }
};
export const config = { schedule: '17 * * * *' };
