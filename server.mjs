import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { adaptRecipe, ChefError, loadApiKey, createAllowedHosts, isAllowedPreviewHost } from './server/chef.mjs';
import { BakerAuthError, readBakerToken, runBakerChef } from './server/baker-auth.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(root, '.env.server')); } catch { /* optional local server settings */ }
const directory = path.join(root, 'dist');
const catalog = JSON.parse(await readFile(path.join(root, '.server/recipes.json'), 'utf8'));
let authConfig = {};
try { authConfig = JSON.parse(await readFile(path.join(root, '.server/firebase.json'), 'utf8')); } catch { /* Missing configuration fails closed. */ }
const port = Number(process.env.PORT || 4331);
const host = process.env.HOST || '0.0.0.0';
const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
const allowedHosts = createAllowedHosts(os.networkInterfaces(), process.env.CHEF_ALLOWED_HOSTS || '');
const buckets = new Map();
let active = 0;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
function privateAddress(ip = '') { return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip.replace(/^::ffff:/, '')) || ip === '::1' || /^(fc|fd|fe80:)/i.test(ip); }
function rateLimited(key, limit, duration) {
  const now = Date.now();
  const previous = buckets.get(key);
  const bucket = previous && previous.until > now ? previous : { count: 0, until: now + duration };
  bucket.count++; buckets.set(key, bucket);
  if (buckets.size > 2000) for (const [k, b] of buckets) if (b.until < now) buckets.delete(k);
  return bucket.count > limit;
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  try {
    if (!isAllowedPreviewHost(req.headers.host, allowedHosts)) return json(res, 403, { error: 'Open this preview using its localhost or local-network address.' });
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/api/')) {
      if (!privateAddress(req.socket.remoteAddress)) return json(res, 403, { error: 'This preview is available to the local network only.' });
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) return json(res, 403, { error: 'Open the chef from this app.' });
      if (pathname === '/api/chef/status' && req.method === 'GET') return json(res, 200, { available: Boolean(await loadApiKey()), model });
      if (pathname !== '/api/chef' || req.method !== 'POST') return json(res, 404, { error: 'Endpoint not found.' });
      readBakerToken(req.headers.authorization);
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Send a JSON recipe request.' });
      if (active >= 2 || rateLimited(req.socket.remoteAddress, 8, 600000) || rateLimited('global', 60, 3600000)) return json(res, 429, { error: 'The chef is busy. Please wait a little and try again.' });
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 90000) { json(res, 413, { error: 'This recipe request is too large.' }); return; } chunks.push(chunk); }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: 'This request could not be read.' }); }
      active++;
      try { return json(res, 200, await runBakerChef(req.headers.authorization, payload, catalog, { authConfig, adapt: adaptRecipe })); } finally { active--; }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
    if (decoded.split('/').some(segment => segment.startsWith('.') || segment.includes('\\'))) { res.writeHead(404); return res.end(); }
    let file = path.resolve(directory, '.' + decoded);
    if (!file.startsWith(directory + path.sep) && file !== directory) { res.writeHead(404); return res.end(); }
    try { if (!(await stat(file)).isFile()) file = path.join(directory, 'index.html'); }
    catch { if (path.extname(decoded)) { res.writeHead(404); return res.end(); } file = path.join(directory, 'index.html'); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (!res.headersSent) json(res, error instanceof ChefError || error instanceof BakerAuthError ? error.status : 500, { error: error instanceof ChefError || error instanceof BakerAuthError ? error.message : 'The server could not complete this request.' });
    else res.end();
  }
});
server.requestTimeout = 100000;
server.listen(port, host, () => {
  console.log(`Pastry Chef: http://localhost:${port}`);
  for (const entries of Object.values(os.networkInterfaces())) for (const entry of entries ?? []) if (entry.family === 'IPv4' && !entry.internal) console.log(`Network: http://${entry.address}:${port}`);
  console.log('AI key remains on the server. Preview API accepts local-network clients only.');
});
