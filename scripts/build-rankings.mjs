import { fileURLToPath } from 'node:url';
import { buildSite } from '../modules/rankings/engine/src/build-site.js';

const result = buildSite({
  configPath: fileURLToPath(new URL('../modules/rankings/site/site.config.json', import.meta.url)),
  outDir: fileURLToPath(new URL('../public/observe/rankings/', import.meta.url)),
  basePath: '/observe/rankings/',
});
console.log(JSON.stringify({ ok: true, ...result }));
