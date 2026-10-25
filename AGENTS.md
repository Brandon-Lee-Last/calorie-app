# Notes for working on this repo

Expo SDK 58 / React Native 0.88 / React 19. Expo changes a lot between SDKs: do not rely on memory.
Read the installed package's own types and README (`node_modules/<pkg>/build/*.d.ts`, `README.md`) before
using an API. The Expo docs site may be unreachable from sandboxed environments.

- Install Expo packages with `npx expo install <pkg>`. If that fails offline (it needs Expo's API), take
  the SDK-compatible version from `node_modules/expo/bundledNativeModules.json` and use `npm install`.
- Never hand-edit `android/` or `ios/`; they are generated (`npx expo prebuild`) and git-ignored.
  Configure native behaviour in `app.json` and config plugins.
- Checks to run before calling something done: `npm run typecheck`, `npm test`, `npm run bundle-check`,
  and `npx expo prebuild --platform android --no-install` when `app.json` or native deps change.
- Native modules (react-native-fast-tflite) need a development build; Expo Go cannot run them.
- Pin `react-dom` to the exact React version (`19.3.0`), or npm refuses to install web packages.
- Jest uses `react-native-reanimated/jest/resolver` and the Reanimated and Worklets mocks (`jest.setup.js`);
  RNTL 14's `render`, `unmount` and `fireEvent` return promises, so await them. Only `__tests__/**/*.test.*` are
  tests; `__tests__/helpers/` holds shared helpers.
- Pure code must not import `src/model/nutritionModel.ts` (it loads the native TFLite library, which Jest cannot);
  model facts such as `MODEL_VERSION` live in `src/model/contract.ts`. Screen tests stub `src/scan/model` and
  `src/scan/photos`; `__tests__/helpers/screen.tsx` mounts a screen on the real data stack and a fake server.
- `npm run test:backend` uses one anonymous account per run: the backend allows 10 new ones an hour per address.
  To reset that on your own local database: `npx wrangler d1 execute calorie-local --local --command "DELETE FROM
  rate_limits WHERE key LIKE 'auth-anon%'"` (in calorie-api).
- Under jest-expo the global `fetch` is Expo's native fetch, stubbed out. Tests use `__tests__/helpers/fakeServer.ts`,
  or `helpers/nodeFetch.ts` with `@jest-environment node` to reach a real server (`npm run test:backend`).

## Layout

Routes in `app/` (Expo Router; tabs use `expo-router/js-tabs` with the custom `src/ui/TabBar`). Tokens in
`src/theme/tokens.ts` come from the design canvas; use them, not raw colours. Text weights come from the font face
(`fontFamily`), never `fontWeight`, so Android renders Plus Jakarta Sans properly.

## Data layer

- All database access goes through `Db` (`src/db/serial.ts` queues every statement and transaction on the one
  connection). Inside `db.transaction(async (tx) => ...)` use `tx` only: calling `db.*` there waits for the
  transaction it is in, forever.
- Schema changes: append a step to `STEPS` in `src/db/migrations.ts`; never edit a released step.
- A synced type with its own table needs a `TableSpec` in `src/data/tables.ts` (columns, and the fields sent in a
  push, matching the backend's PUT body); other types are kept as JSON in `remote_records`.
- Screens read through `useRepoQuery` hooks (`src/data/hooks.ts`), which re-read when `Repo` reports a change.
  Writes go through `Repo`, which queues them for sync in the same transaction.
- If the account changes, the sync engine uploads the phone's data to the new one. A deliberate sign-out must
  therefore clear the database first.
- After backend API changes, `npm run api:types` (backend running) regenerates `src/api/schema.d.ts`; never edit it.
- `src/data/goals.ts` is a copy of the backend's `src/lib/nutrition.ts` (so the onboarding plan works offline and
  matches what the server stores). Change both together; `data.profile.test.ts` pins the backend's test numbers and
  `npm run test:backend` checks the server agrees.
- Work that runs with each sync round (profile changes, scan records) is a task: `sync.addTask(...)` in
  `src/data/stack.ts`. Requests the server refuses outright (`ApiError.permanent`) are dropped, not retried.
- New ids come from `repo.newId()` (expo-crypto on the phone; it returns undefined under Jest, so never call
  `newId` from `src/data/ids.ts` in screens).
- `useCachedApi(key, load)` keeps a server answer in meta (`cache:<key>`) and refreshes it in the background: use it
  for read-only server data a screen should show offline (programs, the subscription's products).
- An effect that writes meta must not depend on an object re-read from meta (useStats re-reads on every meta change):
  key it on a derived value (ids joined into a string), or it loops forever.
- Billing: `src/plus/billing.ts` is the only file that imports expo-iap. Tests mock `expo-iap`. Never grant Plus on
  the phone: send the purchase token to `/v1/subscription/verify`, then acknowledge, then refresh the entitlement.
- The API client makes the anonymous account on the first call that needs one, so screens can call the API before
  the first sync. `SessionManager.ensure` is single-flight; keep it that way (two calls would make two accounts).
- Form limits in `src/data/entryForm.ts` mirror the backend's validation, so saved entries are never rejected on sync.
- The web preview needs cross-origin isolation headers (COOP `same-origin`, COEP `require-corp`) for expo-sqlite's
  WebAssembly build, and runs offline: the backend allows no browser origins.

## Pango

Art source: `design/pango/pango.svg` (copied from the design canvas, holes included). Run `npm run pango:sync`
after changing it; never edit `src/pango/art.generated.ts`. Animated parts become stacked Reanimated views
(`src/pango/layers.ts`) with CSS keyframes from `src/pango/motion.ts`. To check visually without a phone:
`npx expo export --platform web`, serve `dist/` with an SPA fallback and screenshot `/studio`.

## The model

`assets/nutrition_v1.tflite`: input uint8 `[1,224,224,3]` RGB, photo squashed (not cropped) to 224x224,
no scaling in the app; output float32 `[1,6]` = calories (kcal), mass, fat, carb, protein (g), then the probability (0-1) the photo is food. The contract
lives in `src/model/contract.ts` and `assets/MODEL_CARD.md`. react-native-fast-tflite v3: `delegates` is an
array (`[]` = CPU), `run()` takes and returns `ArrayBuffer[]`.

Do not present estimates as exact. The model's typical error is ~77 kcal (30%) on cafeteria photos; phone
photos are untested.
