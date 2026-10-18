# Calorie App

Android app (React Native + Expo) that estimates calories, weight and macros (fat, carbs, protein) from
a photo of food, **entirely on the phone**. The model is `assets/nutrition_v0.tflite` from
[local-calorie-ai-model](https://github.com/Brandon-Lee-Last/local-calorie-ai-model); see
`assets/MODEL_CARD.md` for what it takes, what it returns and how accurate it is.

> **Status: v0 test build, not yet run on a phone.** The code type-checks, the logic tests pass and
> the JavaScript bundles, but the native build and the model running on a device are still to be
> tried. See "What is and is not verified".

## Run it on your phone

**This will not work in the Expo Go app.** Scanning the QR code from `expo start` in Expo Go fails with a
missing-native-module error, because Expo Go does not contain the TFLite library. You need a development
build: your own version of the app with the native code included, installed once on the phone. After
that it works like Expo Go (start the dev server, open the installed app, JavaScript reloads live).
Two ways to make it:

- **A. On your PC** with Android Studio (steps below): `npx expo run:android`.
- **B. In Expo's cloud (EAS), no Android Studio**: needs a free Expo account.
  ```bash
  npx eas-cli login
  npx eas-cli build:configure        # creates eas.json; keep a profile with developmentClient true
  npx eas-cli build --profile development --platform android
  ```
  Install the `.apk` from the link it gives you (allow installs from unknown sources). Not tried yet: this
  was written without access to Expo's servers. If it does not produce an `.apk`, set
  `"android": { "buildType": "apk" }` in that profile.

Either way, day to day: `npm install`, `npx expo start --dev-client`, then open the installed
**Calorie App** (not Expo Go) on the phone, on the same Wi-Fi as the PC.

1. Install Node.js (LTS), a JDK, and Android Studio with the Android SDK. Follow Expo's official guide
   for setting up Android development; I could not open it from my environment, so check it for the
   currently required versions.
2. Turn on USB debugging on your phone (or create an emulator) and plug it in.
3. Keep the project path short (for example `C:\dev\calorie-app`). On Windows, long paths are a common
   cause of React Native native-build failures.
4. In this folder:
   ```bash
   npm install
   npx expo run:android      # first build is slow (many minutes); installs the dev build on the device
   ```
   After that, `npm start` and open the installed app to reload JavaScript changes quickly.

A cloud build with EAS (`npx eas-cli@latest build --profile development --platform android`) also
works in principle, but `eas.json` is not set up yet.

## First thing to do in the app

1. **Model** card should say `Ready · CPU · loaded in N ms`. If it shows a contract problem or an error,
   copy the text and send it over.
2. Tap **Run self-test**. You want three green ticks:
   - *Model tensors*: the file's input/output match the contract.
   - *Golden photo (224 px)*: the exact golden pixels give the expected numbers (about 349 kcal). This
     proves model loading, tensor layout and output order.
   - *Golden photo (256 px, app resizes it)*: tests the app's own resizing against the expected
     numbers. A failure here means the phone's resizing shifts results noticeably; the detail line
     shows by how much.
3. Try **Take photo** / **Choose photo** on food you can weigh, and compare with the real calories.
   Note the model's typical error is about 74 kcal (29%) on the cafeteria test set; phone photos are
   untested.
4. Try the **GPU (experimental)** switch and compare the "model … ms" timing. Stay on CPU if it errors.

## What is and is not verified

Verified (on a Linux dev box, no phone):
- `npm run typecheck`: the code type-checks against the installed libraries' real types.
- `npm test`: 13 tests, including that the JavaScript PNG decoder returns exactly the same pixels as
  Python/PIL for the golden photo (checked by hash), the output order and units, tensor checks and
  display rounding.
- `npm run bundle-check`: Metro bundles the JavaScript to Hermes with the model and golden assets.
- `npx expo prebuild --platform android`: the plugins apply (GPU library entry, camera and photo
  permissions, microphone permission removed, New Architecture and Hermes on).
- The `.tflite` itself matches the PyTorch model to under 0.001 kcal/g on 260 real photos (ML repo).

**Not verified**: the Android native build, the model running on a device (CPU or GPU), the camera and
gallery flow, and whether the app's resizing matches training closely enough. Specific risks:
- **Resizing.** Training squashed photos with PIL bilinear resizing; the phone resizes with its own
  library (the 256 px self-test measures this).
- **Photo orientation.** Whether camera photos arrive upright (EXIF rotation) was not checked.
- **GPU delegate** support for this model on your phone.
- **First native build** with the New Architecture and the Nitro modules library.

## How a photo becomes an estimate

`src/imaging/photoToRgb.ts`: decode (capped at 1024 px) -> squash to 224 x 224 -> PNG (lossless) ->
`src/imaging/pngToRgb.ts` -> raw RGB bytes -> `src/model/nutritionModel.ts` -> 5 numbers
(`src/model/contract.ts` maps them to calories, weight, fat, carbs, protein).

## Updating the model

Copy the new `.tflite`, `MODEL_CARD.md` and `golden/` from the ML repo's `models/` folder into
`assets/`, update `TYPICAL_ERROR` in `src/model/contract.ts` from the new model card, then re-run the
in-app self-test.

## Before releasing

- Change the Android package id (`com.brandonleelast.calorieapp` in `app.json`); it is permanent once
  published.
- Review permissions, name, icons and splash screen (still Expo's defaults).
- Choose a licence for this repo (none is set).
- Credit Nutrition5k in the app (shown on the main screen) and re-check the licence terms.
- Say plainly in the store listing that results are rough estimates, not medical or dietary advice.
