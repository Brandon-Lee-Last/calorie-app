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

## The model

`assets/nutrition_v0.tflite`: input uint8 `[1,224,224,3]` RGB, photo squashed (not cropped) to 224x224,
no scaling in the app; output float32 `[1,5]` = calories (kcal), mass, fat, carb, protein (g). The contract
lives in `src/model/contract.ts` and `assets/MODEL_CARD.md`. react-native-fast-tflite v3: `delegates` is an
array (`[]` = CPU), `run()` takes and returns `ArrayBuffer[]`.

Do not present estimates as exact. The model's typical error is ~74 kcal (29%) on cafeteria photos; phone
photos are untested.
