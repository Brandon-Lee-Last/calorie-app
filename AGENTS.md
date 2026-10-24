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
  RNTL 14's `render` and `unmount` return promises, so await them.

## Layout

Routes in `app/` (Expo Router; tabs use `expo-router/js-tabs` with the custom `src/ui/TabBar`). Tokens in
`src/theme/tokens.ts` come from the design canvas; use them, not raw colours. Text weights come from the font face
(`fontFamily`), never `fontWeight`, so Android renders Plus Jakarta Sans properly.

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
