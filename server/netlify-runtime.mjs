import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getStore } from '@netlify/blobs';
import { createNetlifyChefHandler } from './netlify-chef.mjs';
import { quotaStoreName } from './netlify-quota.mjs';

let runtime;
// Literal paths keep Netlify's file tracer from including local preview logs.
const loadRuntime = () => runtime ??= Promise.all([
  readFile(path.join(process.cwd(), '.server', 'recipes.json'), 'utf8').then(JSON.parse),
  readFile(path.join(process.cwd(), '.server', 'firebase.json'), 'utf8').then(JSON.parse),
]).then(([catalog, authConfig]) => ({ catalog, authConfig }));
export const publicChef = createNetlifyChefHandler({ loadRuntime, storeFactory: () => getStore({ name: quotaStoreName, consistency: 'strong' }) });
