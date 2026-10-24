// Refreshes the backend's API description and the TypeScript types generated from it.
//   npm run api:types                      (backend from `wrangler dev` on this PC)
//   npm run api:types -- https://api.example.com
//   npm run api:types -- ../calorie-api/openapi.json
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const source = process.argv[2] ?? process.env.API_URL ?? 'http://127.0.0.1:8787';
let spec;
if (existsSync(source)) {
  spec = JSON.parse(readFileSync(source, 'utf8'));
} else {
  const url = `${source.replace(/\/+$/, '')}/v1/openapi.json`;
  const res = await fetch(url).catch((e) => {
    console.error(`Could not reach ${url}: ${e.message}. Is the backend running (npx wrangler dev in calorie-api)?`);
    process.exit(1);
  });
  if (!res.ok) {
    console.error(`${url} answered ${res.status}`);
    process.exit(1);
  }
  spec = await res.json();
}
writeFileSync('api/openapi.json', JSON.stringify(spec, null, 4) + '\n');
console.log(`api/openapi.json: ${Object.keys(spec.paths ?? {}).length} paths`);

// openapi-typescript wants TypeScript 5 as a peer, so it runs on its own rather than as a dependency.
const r = spawnSync('npx', ['--yes', 'openapi-typescript@7.13.0', 'api/openapi.json', '-o', 'src/api/schema.d.ts'], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
