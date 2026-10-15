import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';

// Static delivery: preserve HTML, metadata, URLs and source asset names verbatim.
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
if (!out.startsWith(root + sep)) throw new Error('Build output outside project');
const html = await readFile(resolve(root, 'zarven-landing-page.html'), 'utf8');
const files = new Set(['zarven-landing-page.html', 'model-worker.js']);
for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|data:|#)/.test(value)) continue;
  const file = decodeURIComponent(value.split('?')[0]);
  if (resolve(root, file).startsWith(root + '/') || resolve(root, file).startsWith(root + '\\')) files.add(file);
  else throw new Error(`Asset outside project: ${file}`);
}
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of files) {
  const target = resolve(out, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, file), target);
}
await writeFile(resolve(out, 'index.html'), html);
console.log(`Build OK: ${files.size + 1} static files in dist/. Original page URL preserved.`);
