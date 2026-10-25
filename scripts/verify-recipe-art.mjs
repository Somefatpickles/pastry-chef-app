import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = process.argv[2] || 'http://127.0.0.1:4331';
const manifest = JSON.parse(await readFile(new URL('../docs/recipe-artwork-manifest.json', import.meta.url)));
const recipes = JSON.parse(await readFile(new URL('../.server/recipes.json', import.meta.url)));
assert.equal(manifest.assets.length, 68);
assert.deepEqual(new Set(manifest.assets.map(asset => asset.id)), new Set(recipes.map(recipe => recipe.id)));
assert.equal(new Set(manifest.assets.map(asset => asset.sha256)).size, 68);
const requests = manifest.assets.flatMap(asset => [
  { file: asset.source, sha256: asset.sha256 },
  { file: asset.thumbnail, sha256: asset.thumbnailSha256 },
]);
let cursor = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < requests.length) {
    const request = requests[cursor++];
    const response = await fetch(new URL(request.file, base));
    assert.equal(response.status, 200, request.file);
    assert.match(response.headers.get('content-type') ?? '', /^image\/webp(?:;|$)/i, request.file);
    const content = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(content).digest('hex'), request.sha256, request.file);
  }
}));
console.log(`Verified ${requests.length} live WebP files for all ${manifest.assets.length} recipes: coverage, media types and SHA-256 hashes passed.`);
