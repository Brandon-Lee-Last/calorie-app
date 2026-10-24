# Calorie App

Android app (React Native + Expo) that estimates calories, weight and macros (fat, carbs, protein) from
a photo of food, **entirely on the phone**. The model is `assets/nutrition_v1.tflite` from
[local-calorie-ai-model](https://github.com/Brandon-Lee-Last/local-calorie-ai-model); see
`assets/MODEL_CARD.md` for what it takes, what it returns and how accurate it is.

> **Status: foundations (navigation, design system, Pango the mascot) and the data layer are in, on top of the v1
> model build.** Today shows your own meals and water, saved on the phone and backed up to the backend when it can
> reach it. The code type-checks, the tests pass (including against the real backend running locally) and the
> JavaScript bundles, but the native build, the model and the database running on a device are still to be tried.
> See "What is and is not verified".

## Run it on your phone

**This will not work in the Expo Go app.** Scanning the QR code from `expo start` in Expo Go fails with a
missing-native-module error, because Expo Go does not contain the TFLite library. You need your own build
of the app. There are two kinds.

### Option 1: standalone APK (simplest for testing)

The JavaScript is built into the app, so there is no dev server and no PC connection: install it and tap
the icon. No live reloading, but this app shows its own errors on screen. It is signed with a debug key
(fine for testing, not for the Play Store). Release minification is switched off in `app.json` on purpose,
to rule it out while checking that the native model library works; turn it back on later to shrink the APK.

**In Expo's cloud (EAS), no Android Studio needed.** Free Expo account:
```bash
npm install
npx eas-cli login
npx eas-cli build --platform android --profile preview
```
The first run asks to create an EAS project for this app (say yes). When the build finishes it prints a
link to the `.apk`. Open it on the phone, download, and install (allow "install unknown apps" for your
browser when asked). Not tried yet: `eas.json` and these steps were written without access to Expo's
servers. If the CLI rejects `eas.json`, run `npx eas-cli build:configure` to regenerate it.

**On your PC (needs Android Studio, the Android SDK and a JDK; follow Expo's own guide for the current
versions, which I could not open from my environment).** With the phone plugged in and USB debugging on:
```bash
npm install
npx expo run:android --variant release
```
This builds the release APK and installs it. Keep the project path short (for example `C:\dev\calorie-app`):
long Windows paths often break React Native native builds. The first build takes many minutes.

### Option 2: development build (live coding)

For editing the JavaScript with instant reload, build a development client once, then reuse it:
- On your PC: `npx expo run:android` (debug variant), or in the cloud:
  `npx eas-cli build --platform android --profile development` and install the `.apk` it links to.
- Day to day: `npm install`, `npx expo start --dev-client`, then open the installed **Calorie App** (not
  Expo Go) on the phone, on the same Wi-Fi as the PC.

## Connecting to the backend

The app works without a server: everything is saved on the phone first, and Today and Me say "Offline" until the
backend answers. On the first backup the app makes an anonymous account for the phone (signing in with Google or
email comes later).

Where the app looks for the backend ([calorie-api](https://github.com/Brandon-Lee-Last/calorie-api)):
- Set `EXPO_PUBLIC_API_URL`. The easy way on Windows is a file named `.env.local` in this folder (git ignores it):
  ```
  EXPO_PUBLIC_API_URL=http://192.168.1.20:8787
  ```
  Expo reads it when Metro starts or a build is made, so restart `npx expo start` after changing it.
- Without it, the Android emulator uses `http://10.0.2.2:8787` (your PC as the emulator sees it).

**Backend on your PC (`wrangler dev`) with a real phone on the same Wi-Fi:**
1. In `calorie-api`: `npx wrangler dev --local --port 8787 --ip 0.0.0.0` (`0.0.0.0` lets the phone reach it;
   Windows may ask to allow it through the firewall: allow it on private networks).
2. Find the PC's Wi-Fi address (`ipconfig`, "IPv4 Address") and put it in `.env.local` as above.
3. Use a **development build** (Option 2). Android only allows plain `http://` in debug builds; a release APK
   (Option 1) needs an `https://` backend, such as your deployed Cloudflare Worker. For an EAS build, set
   `EXPO_PUBLIC_API_URL` for the profile in `eas.json` (`"env": {...}`) or in the EAS project's environment variables.
4. **Me > Account and backup** shows the server address in use and the backup state; "Back up now" retries.

## First thing to do in the app

The app opens on **Today**. To check the model, tap the round **scan** button in the middle of the tab bar (or
**Me > Model lab**), then:

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
- `npm test`: 108 tests, including that the JavaScript PNG decoder returns exactly the same pixels as
  Python/PIL for the golden photo (checked by hash), the output order and units, tensor checks and
  display rounding; for Pango, that every pose and outfit draws every visible part exactly once and renders;
  and for the data layer, the real SQL schema (on sql.js) with sync against a fake server: two phones editing the
  same entry, edits made mid-sync, rejected changes, paging, the server asking for a full resync, offline backoff,
  token refresh, moving data to a new account, and Today and Add food driven like a user would.
- `npm run test:backend`: the data layer against the real backend (`wrangler dev`): back up from one phone,
  restore, edit and delete on a second, and read the profile.
- A web build (`npx expo export --platform web`) was screenshotted: Today, Me and Pango studio match the design
  canvas in dark and light, Pango's animations run, and they stop when the system asks for reduced motion. The
  data screens were walked through in it (add water, a form error, add and edit a meal, Me), offline, as browsers
  cannot reach the backend (it allows no web origins).
- `npm run bundle-check`: Metro bundles the JavaScript to Hermes with the model and golden assets.
- `npx expo prebuild --platform android`: the plugins apply (GPU library entry, camera and photo
  permissions, microphone permission removed, New Architecture and Hermes on, the session kept out of Android's
  backups) and SQLite, Secure Store and Crypto are linked.
- The `.tflite` itself matches the PyTorch model to under 0.001 kcal/g on 260 real photos (ML repo).

**Not verified**: the Android native build, the model running on a device (CPU or GPU), the camera and
gallery flow, whether the app's resizing matches training closely enough, and SQLite, Secure Store and backup
over Wi-Fi on a real phone. Specific risks:
- **Resizing.** Training squashed photos with PIL bilinear resizing; the phone resizes with its own
  library (the 256 px self-test measures this).
- **Photo orientation.** Whether camera photos arrive upright (EXIF rotation) was not checked.
- **GPU delegate** support for this model on your phone.
- **First native build** with the New Architecture and the Nitro modules library.
- **Model loading in a standalone APK.** The app copies the bundled model out of the APK into the cache
  with `expo-asset` and gives the TFLite library a `file://` URL, because that library cannot read a bare
  Android resource name. This is reasoned from both libraries' source code and works in the bundle and
  prebuild checks, but has not run on a device. The golden photos are embedded in the code as base64 for
  the same reason (image assets resolve to drawable names in a standalone build).

## App structure

- `app/`: screens, by route (Expo Router). `(tabs)/` holds Today, Train, Progress and Me; `add` (add or edit a
  meal), `studio` and `lab` are pushed screens.
- `src/data/`: what the screens read and write (`repo.ts`), the sync engine (`sync.ts`), the provider and hooks
  (`DataProvider.tsx`, `hooks.ts`). `src/db/`: the phone's SQLite and its migrations. `src/auth/`: the session.
  `src/api/`: the typed backend client; `schema.d.ts` is generated from `api/openapi.json` by `npm run api:types`.
- `src/config.ts`: the backend address and app version.
- `src/theme/`: design tokens from the design canvas (colours for dark and light, spacing, radii, type), the theme
  provider and fonts (Plus Jakarta Sans, SIL Open Font License).
- `src/ui/`: shared pieces (Text, Button, Card, Chip, Segmented, ProgressBar, Ring, Icon, IconButton, Screen,
  TabBar, EmptyState). Touch targets are at least 44 points.
- `src/pango/`: the mascot (below).
- `src/lab/`: the original v1 screen's pieces, used by the Model lab until the real scan flow replaces it.
- `src/model/`, `src/imaging/`: the on-device model and photo preparation.

## Pango (the mascot)

`<Pango pose="wave" outfit="gym" size={160} />`. Poses: idle, wave, scan, eat, cheer, think, oops, sleep, roll.
Outfits, hats, glasses, scarf colour and pattern, pins and scale colours are props too; `crop="face"` frames the
head for avatars; `motion={false}` holds still (Pango also holds still when the phone asks for reduced motion).

The art lives in one place: `design/pango/pango.svg`, copied from the design canvas. `npm run pango:sync` turns it
into `src/pango/art.generated.ts`. Moving parts (tail, head, eyes, arms, scarf...) are drawn as separate stacked
layers so native views can animate them, using the timings in `src/pango/motion.ts` (from
`design/pango/pango.css`). **Me > Pango studio** shows every pose and outfit on the phone.

## Your data

Meals, water and weight are written to SQLite on the phone at once, together with a queue of changes for the
server (`outbox`). The sync engine sends the queue to `/v1/sync/push`, then fetches other devices' changes from
`/v1/sync/pull`: shortly after each change, when the app comes to the front, and every 5 minutes while it is open.
If two phones change the same entry, the later edit wins. The session (access and refresh tokens) is kept in the
phone's secure store.

After the backend's API changes: start it, then `npm run api:types` refreshes `api/openapi.json` and the generated
types; `npm run typecheck` shows what the change broke.

## How a photo becomes an estimate

`src/imaging/photoToRgb.ts`: decode (capped at 1024 px) -> squash to 224 x 224 -> PNG (lossless) ->
`src/imaging/pngToRgb.ts` -> raw RGB bytes -> `src/model/nutritionModel.ts` -> 5 numbers
(`src/model/contract.ts` maps them to calories, weight, fat, carbs, protein).

## Food / not-food ("it gave my dog 200 calories")

The first model (v0) was trained only on food, so it would "estimate" anything, a dog included. The bundled
`nutrition_v1.tflite` has a sixth output, the probability the photo shows food: below `FOOD_THRESHOLD`
(`src/model/contract.ts`, 0.5) the app shows "This doesn't look like food" with an "Estimate anyway" button
instead of calories. On 3,000 held-out Open Images photos the model rejected 98.8% of dogs and cats and
98.2% of people and accepted 91.5% of real food (`assets/MODEL_CARD.md`), so some real food will be turned
away; that is what the button is for. How it does on photos from your phone is not measured yet.

## Updating the model

Copy the new `.tflite`, `MODEL_CARD.md` and `golden/` from the ML repo's `models/` folder into
`assets/`, run `node scripts/embed-golden.mjs` (the golden photos are embedded in the code), point
`MODEL_ASSET` in `src/model/nutritionModel.ts` at the new file name if it changed, update `TYPICAL_ERROR` and
`FOOD_THRESHOLD` in `src/model/contract.ts` from the new model card, then re-run the in-app self-test. With a
food output the self-test also checks that the golden photo is accepted as food.

## Before releasing

- Change the Android package id (`com.brandonleelast.calorieapp` in `app.json`); it is permanent once
  published.
- Review permissions, name, icons and splash screen (still Expo's defaults).
- Choose a licence for this repo (none is set).
- Credit Nutrition5k in the app (shown on the main screen) and re-check the licence terms.
- Say plainly in the store listing that results are rough estimates, not medical or dietary advice.
