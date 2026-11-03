import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execute } from './core.js';
import { manifest, openapi } from './contracts.js';
import { renderCatalog } from './catalog-view.js';
export { renderCatalog } from './catalog-view.js';
import { schemas } from './schema.js';
export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export async function publicFiles(store, basePath = '/observe', transport = 'http') {
  const catalog = await execute(store, 'catalog.export');
  const files = new Map();
  const json = (path, value) => files.set(path, `${JSON.stringify(value, null, 2)}\n`);
  files.set('index.html', renderCatalog(catalog, basePath, transport));
  files.set('SKILL.md', await readFile(resolve(ROOT, 'skills/contribute/SKILL.md'), 'utf8'));
  files.set('search.js', await readFile(resolve(ROOT, 'src/search.js'), 'utf8'));
  files.set('DATA-LICENSE.md', await readFile(resolve(ROOT, 'data/LICENSE.md'), 'utf8'));
  json('manifest.json', manifest(basePath, transport)); json('openapi.json', openapi(basePath)); json('catalog.json', catalog);
  for (const [name, schema] of Object.entries(schemas)) json(`schemas/${name}.json`, { $schema: 'https://json-schema.org/draft/2020-12/schema', ...schema });
  for (const record of catalog.records) json(`companies/${record.company.id}.json`, record);
  for (const name of ['proposal', 'inquiry', 'search-ph']) files.set(`examples/${name}.json`, await readFile(resolve(ROOT, `examples/${name}.json`), 'utf8'));
  return files;
}
export async function build(store, { outDir = resolve(ROOT, 'dist'), basePath = '/observe', transport = 'github' } = {}) {
  const files = await publicFiles(store, basePath, transport);
  for (const [name, content] of files) { const path = join(outDir, name); await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, content); }
  return { outDir, files: [...files.keys()] };
}
