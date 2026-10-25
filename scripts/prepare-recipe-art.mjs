import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Authoring tool only; generated WebP files do not require Sharp at app runtime.
const require = createRequire(import.meta.url);
const sharp = require(process.env.CRUMBCRAFT_SHARP_MODULE || 'sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const partial = process.argv.includes('--partial');
const catalog = JSON.parse(await readFile(path.join(root, '.server/recipes.json'), 'utf8'));
const records = new Map();
for (const batch of ['a', 'b', 'c']) {
  try {
    const manifest = JSON.parse(await readFile(path.join(root, `artifacts/recipe-art-batch-${batch}.json`), 'utf8'));
    for (const record of manifest.assets ?? manifest.records ?? []) records.set(record.id, record);
  } catch (error) { if (!partial) throw error; }
}
const available = catalog.filter(recipe => records.has(recipe.id));
if (!partial && available.length !== 68) throw new Error(`Expected 68 generated recipe originals; found ${available.length}.`);
for (const recipe of available) if (typeof records.get(recipe.id).prompt !== 'string' || !records.get(recipe.id).prompt.trim()) throw new Error(`Missing generation prompt: ${recipe.id}`);
const output = path.join(root, 'public/recipe-images');
await mkdir(output, { recursive: true });
let previous = [];
try { previous = JSON.parse(await readFile(path.join(root, 'artifacts/recipe-art-progress.json'), 'utf8')).assets; } catch { /* first preparation */ }
const previousById = new Map(previous.map(record => [record.id, record]));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const prepared = [];
for (const recipe of available) {
  const originalFile = `artifacts/recipe-image-originals/${recipe.id}.png`;
  const original = await readFile(path.join(root, originalFile));
  const sourceSha256 = digest(original);
  const fullFile = path.join(output, `${recipe.id}.webp`);
  const smallFile = path.join(output, `${recipe.id}-320.webp`);
  let unchanged = previousById.get(recipe.id)?.sourceSha256 === sourceSha256;
  if (unchanged) { try { await access(fullFile); await access(smallFile); } catch { unchanged = false; } }
  if (!unchanged) {
    await sharp(original).rotate().resize(640, 400, { fit: 'cover', position: 'centre' }).webp({ quality: 80 }).toFile(fullFile);
    await sharp(original).rotate().resize(320, 200, { fit: 'cover', position: 'centre' }).webp({ quality: 78 }).toFile(smallFile);
  }
  const [full, small] = await Promise.all([readFile(fullFile), readFile(smallFile)]);
  const [fullMeta, smallMeta] = await Promise.all([sharp(full).metadata(), sharp(small).metadata()]);
  if (fullMeta.width !== 640 || fullMeta.height !== 400 || smallMeta.width !== 320 || smallMeta.height !== 200) throw new Error(`Wrong image dimensions: ${recipe.id}`);
  const generatorRecord = Object.fromEntries(Object.entries(records.get(recipe.id)).filter(([key]) => key !== 'prompt'));
  prepared.push({ id: recipe.id, title: recipe.title, source: `/recipe-images/${recipe.id}.webp`, thumbnail: `/recipe-images/${recipe.id}-320.webp`, width: 640, height: 400, bytes: full.length, thumbnailBytes: small.length, sha256: digest(full), thumbnailSha256: digest(small), sourceSha256, originalFile, generator: 'builtin image_gen', prompt: records.get(recipe.id).prompt, generatorRecord });
}
if (new Set(prepared.map(record => record.sha256)).size !== prepared.length) throw new Error('Duplicate recipe artwork detected.');
const report = { generatedOn: new Date().toISOString(), expected: 68, count: prepared.length, totalBytes: prepared.reduce((total, item) => total + item.bytes + item.thumbnailBytes, 0), assets: prepared };
await writeFile(path.join(root, 'artifacts/recipe-art-progress.json'), JSON.stringify(report, null, 2));
if (!partial) await writeFile(path.join(root, 'docs/recipe-artwork-manifest.json'), JSON.stringify(report, null, 2));

const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
for (let sheet = 0; sheet < Math.ceil(prepared.length / 17); sheet++) {
  const group = prepared.slice(sheet * 17, (sheet + 1) * 17);
  const layers = [];
  const labels = [];
  for (let index = 0; index < group.length; index++) {
    const asset = group[index];
    const left = index % 4 * 240;
    const top = Math.floor(index / 4) * 190;
    layers.push({ input: await sharp(path.join(root, 'public', asset.source)).resize(232, 145).png().toBuffer(), left: left + 4, top: top + 4 });
    const words = `${sheet * 17 + index + 1}. ${asset.title}`.split(' ');
    const lines = [''];
    for (const word of words) {
      const line = lines.length - 1;
      if ((lines[line] + ' ' + word).trim().length > 32 && lines[line]) lines.push(word);
      else lines[line] = (lines[line] + ' ' + word).trim();
    }
    labels.push(`<text x="${left + 120}" y="${top + 164}" text-anchor="middle" font-family="Georgia" font-size="12" fill="#57321f">${lines.slice(0, 2).map((line, lineIndex) => `<tspan x="${left + 120}" dy="${lineIndex ? 15 : 0}">${escape(line)}</tspan>`).join('')}</text>`);
  }
  const sheetHeight = Math.ceil(group.length / 4) * 190;
  layers.push({ input: Buffer.from(`<svg width="960" height="${sheetHeight}">${labels.join('')}</svg>`), left: 0, top: 0 });
  const prefix = partial ? 'recipe-art-progress-sheet' : 'recipe-art-sheet';
  await sharp({ create: { width: 960, height: sheetHeight, channels: 4, background: '#fff8f1' } }).composite(layers).png().toFile(path.join(root, `artifacts/${prefix}-${sheet + 1}.png`));
}
console.log(JSON.stringify({ count: report.count, expected: report.expected, totalBytes: report.totalBytes, complete: report.count === 68 }, null, 2));
