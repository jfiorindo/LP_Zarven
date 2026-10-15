import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Static delivery: preserve HTML, metadata, URLs and source asset names verbatim.
const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'zarven-landing-page.html'), 'utf8');
const files = new Set(['zarven-landing-page.html', 'model-worker.js']);
for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|data:|#)/.test(value)) continue;
  const file = decodeURIComponent(value.split('?')[0]);
  if (resolve(root, file).startsWith(root + '/') || resolve(root, file).startsWith(root + '\\')) files.add(file);
  else throw new Error(`Asset outside project: ${file}`);
}
await mkdir(resolve(root, 'dist'), { recursive: true });
for (const file of files) await copyFile(resolve(root, file), resolve(root, 'dist', file));
await writeFile(resolve(root, 'dist', 'index.html'), html);
console.log(`Build OK: ${files.size + 1} static files in dist/. Original page URL preserved.`);
