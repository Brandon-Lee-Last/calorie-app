// Runs the data layer against a real backend (default: `wrangler dev` on this PC).
//   npm run test:backend
//   npm run test:backend -- https://staging.example.com
import { spawnSync } from 'node:child_process';

const env = { ...process.env, API_URL: process.argv[2] ?? process.env.API_URL ?? 'http://127.0.0.1:8787' };
const r = spawnSync('npx', ['jest', '__tests__/integration.backend.test.ts'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
