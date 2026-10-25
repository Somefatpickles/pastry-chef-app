import { build, loadEnv } from 'vite';
import { build as bundle } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { stdio: 'inherit' });
// Inline configuration avoids spawning esbuild to bundle vite.config.ts on restricted Windows hosts.
const { default: react } = await import('@vitejs/plugin-react');
await build({ configFile: false, plugins: [react()] });
const result = await bundle({ entryPoints: ['src/recipeLibrary.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { recipes } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
await mkdir('.server', { recursive: true });
await writeFile('.server/recipes.json', JSON.stringify(recipes));
const firebaseEnv = loadEnv('production', process.cwd(), 'VITE_');
await writeFile('.server/firebase.json', JSON.stringify({ apiKey: firebaseEnv.VITE_FIREBASE_API_KEY || '', projectId: firebaseEnv.VITE_FIREBASE_PROJECT_ID || '' }));
console.log(`Prepared ${recipes.length} recipes for the server.`);
