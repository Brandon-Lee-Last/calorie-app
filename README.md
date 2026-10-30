# Pango

Android app (React Native + Expo) that estimates calories, weight and macros (fat, carbs, protein) from
a photo of food, **entirely on the phone**. The model is `assets/nutrition_v1.tflite` from
[local-calorie-ai-model](https://github.com/Brandon-Lee-Last/local-calorie-ai-model); see
`assets/MODEL_CARD.md` for what it takes, what it returns and how accurate it is.

> **Status: every screen in the design is in: onboarding, the camera and scan result, barcodes, the diary, "What
> fits?", Progress with the weekly recap, Train with workout logging, Pango's wardrobe and Plus (Google Play
> subscriptions), on top of the data layer and the v1 model.** Everything is saved on the phone and backed up when the
> backend can be reached. The code type-checks, the tests pass (including against the real backend running locally),
> and GitHub builds an installable APK on every push (see "Run it on your phone"), but the app has not been opened on a
> phone yet, so the camera, the model and purchases are untested on a device. See "What is and is not verified".

## Run it on your phone

**This will not work in the Expo Go app.** Scanning the QR code from `expo start` in Expo Go fails with a
missing-native-module error, because Expo Go does not contain the TFLite library. You need your own build
of the app. There are two kinds.

### Option 1: standalone APK (simplest for testing)

The JavaScript is built into the app, so there is no dev server and no PC connection: install it and tap
the icon. No live reloading, but this app shows its own errors on screen. It is signed with a debug key
(fine for testing, not for the Play Store). Release minification is switched off in `app.json` on purpose,
to rule it out while checking that the native model library works; turn it back on later to shrink the APK.

**Easiest: download the one GitHub built.** Every push to `main` or a `claude/...` branch runs
`.github/workflows/android.yml`. It type-checks, runs the tests, then builds a release APK (arm64, which covers
phones from the last several years). On the phone or PC:
1. Open the repo on GitHub > **Actions** > **Android build** > the newest run with a green tick.
2. Under **Artifacts** at the bottom, download **calorie-app-apk**. It is a `.zip`; inside is `app-release.apk`.
3. Copy the `.apk` to the phone if needed, open it and install. Allow "install unknown apps" for the browser or file
   manager when asked. Play Protect may warn that it does not know the app; choose to install anyway.
4. To update, install a newer one over it. Your diary stays, because every build is signed with the same key.
   If Android says the package conflicts, uninstall the old app first (this deletes data not yet backed up).

To let that APK reach your backend, set a repository **variable** (not a secret, it is not private) named
`EXPO_PUBLIC_API_URL` to the deployed `https://` address of calorie-api: **Settings > Secrets and variables > Actions >
Variables > New repository variable**. Then re-run the workflow (Actions > Android build > **Run workflow**). Without
it the app works fully offline and Me shows "Offline".

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
- Day to day: `npm install`, `npx expo start --dev-client`, then open the installed **Pango** app (not
  Expo Go) on the phone, on the same Wi-Fi as the PC.

## Connecting to the backend

The app works without a server: everything is saved on the phone first, and Today and Me say "Offline" until the
backend answers. On the first backup the app makes an anonymous account for the phone (signing in with Google or
email comes later).

Where the app looks for the backend ([calorie-api](https://github.com/Brandon-Lee-Last/calorie-api)):
- **Built in: the stage backend**, `https://pango-api-stage.lightarch.io` (`expo.extra.apiUrl` in `app.json`;
  production will be `https://pango-api.lightarch.io`), so the APK from GitHub Actions backs up, searches foods and looks up barcodes with nothing to set.
  `.github/workflows/stage-check.yml` runs the data layer against it on every push that touches the data code.
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

The first time, Pango asks what you are working towards, a few facts (year of birth, height, weight, activity) and
shows a daily plan worked out with the same formula as the backend (Mifflin-St Jeor, with a safety floor). You can
skip it and keep the defaults. Then:

- **Search for a food**: "Add breakfast/lunch/…" on Today opens search, like Samsung Health's. Before you type it
  lists your recent meals (one tap to log again, offline too). As you type it shows your own meals that match, then
  the shared food list: generic foods from USDA and packaged South African products from Open Food Facts, which the
  backend's **Food catalogue** workflow loads (see calorie-api's `docs/operations.md`). Not there? **Search Open Food
  Facts** asks their whole database (millions of products) from the phone. Each result shows its calories per 100 g
  as well as per serving, so foods with the same name can be compared. Pick a food, choose servings or grams and the
  meal, save. **Barcode**, **Photo** and **Type it in** are on the same screen. Search needs the backend.
- **Scan a meal**: the round button in the middle of the tab bar opens the camera. *Plate* takes a photo for the
  model; *Barcode* reads a pack's barcode and looks it up (needs a connection). The photo button picks one from the
  gallery instead. On the result, change the portion, name it if you like, pick the meal and save.
- **Diary**: the calendar button on Today. Pick any day of the week, copy a meal from the last time you had it,
  or add one of your usuals (meals you have logged at least twice) in one tap. Every row shows how much was eaten
  ("172 g", "1 serving (30 g)"), because the same food in a different amount has different calories. Open one to see
  its calories per 100 g and change the amount: the calories and macros follow.
- **What fits?**: on Today and in the diary. Ideas from your own meals and common South African dishes, shrunk to a
  smaller portion when the whole plate would not fit what is left today.
- **Meal plans**: "Want a meal plan?" on Today, or open the plan from there. Pick a style (Balanced and Budget are
  free; High protein, Mediterranean, Low carb, Vegetarian and Plant-based come with Plus) and Pango plans breakfast,
  lunch, dinner and a snack (two from 2,400 kcal) with portions sized to your calorie goal. Log a planned meal in one
  tap, swap one you do not fancy, or tap **Use what I have** to make that meal from your groceries instead (My groceries
  opens aimed at its calories; **Put in my plan** swaps the idea in, **Back to the planned meal** undoes it, and it
  stays off the shopping list). Open a recipe: ingredients scaled to your portion in grams and kitchen measures
  ("about 4 eggs" for 1¼ portions of a three-egg scramble), and a step-by-step method. 1 portion is the recipe as
  written; the plan sizes each meal from ½ to 2 portions so the day adds up to your goal. Free plans today and
  tomorrow; Plus plans the week ahead and adds a shopping list by shop aisle, to tick off or send. The meals and their
  numbers come from the backend (`/v1/meal-plans`, worked out from USDA figures; see calorie-api's
  `docs/meal-plans.md`); the planning happens on the phone, so it works offline once loaded.
- **Ask Pango**: tap Pango's face at the top of Today (it wears a chat badge), or the chat card on Today, whose quick
  questions send straight away. Chat with Pango about food, training, sleep or motivation; Pango knows your goals and
  what you have logged. While it answers, Pango thinks it over with bouncing dots, then the reply types out at a
  steady pace inside a bubble that is already its final size, so nothing jumps (tap it to see it all; crisis replies
  and "reduce motion" show at once). The server checks the whole answer before releasing it, so the typing is played
  on the phone rather than streamed. The message box stays above the keyboard. Replies are plain text. If someone
  seems to be in crisis, Pango answers with South African helplines (tap to call). **Meals from my groceries** (on the same card, or a chip in the chat): add what you have at
  home from the food list, pick a meal, and Pango suggests up to three recipes, each with the ingredients for your
  portion (and each one's calories) and a numbered method; the calories are worked out by the server from your foods'
  own figures, never by the AI. Free accounts get 10 questions a day (3 before a sign-in is
  linked), Plus 60. The safety design is in calorie-api's `docs/coach.md`.
- **Activity**: the Activity card on Today, and its screen. Steps and calories burned against daily goals (8,000 steps
  and 300 kcal to start; change them there). On Android, **Connect Health Connect** reads your step count from Health
  Connect, where Samsung Health, Google Fit, Fitbit and most watches save theirs (read only; Health Connect is built
  into Android 14 and up, and on Google Play for older phones). Pango reads it while open: on start, when you come back
  to it, and every five minutes. Without Health Connect, type a day's steps in. Distance and calories are estimates
  from your height and weight (walking burns about 0.5 kcal per kg per km on top of resting). Walking beyond a usual
  day for your activity level (7,500 steps for "light") adds to the day's food at the eat-back setting on Train, as
  workouts do. **Celebrations**: Pango cheers, with confetti, when you reach either goal, beat your best day, or reach
  a streak of 3, 7, 14, 30, 50, 100 or 365 days; each is shown once.
- **Progress**: your weight trend (log a weigh-in or set a goal weight there), the weekly recap (three tap-through
  cards about last week, shareable) and a month calendar of days on target.
- **Train**: quick workouts built into the app (bodyweight, dumbbells, core, cardio, mobility) that work offline,
  plus any programs on the server. A workout shows each exercise with how to do it and what you did last time; log
  each set, rest between them, finish to save it. Choose how much of the energy burned goes back into the day's food.
- **Me > Pango's wardrobe**: looks for Pango earned by logging, streaks, scans, water and workouts. Whatever Pango
  wears shows up around the app. **Dress for the moment** (on by default, at the bottom of the wardrobe) lets Pango
  borrow a look for the occasion: gym kit on Train and workouts, the chef's hat on What fits, the party look on the
  weekly recap, and a protea everywhere on Heritage Day. **Me > Your daily plan** changes the calorie and macro goals.
- **Me > Your data**: **Download my data** backs up, then hands Android's share sheet a JSON file with everything the
  server holds (save it to Drive, email it). **Delete my account** asks first, deletes the account on the server and
  empties the phone, then starts again at onboarding; if the server cannot be reached nothing is deleted.
- **Notes from the server** (`/v1/config`, checked when the app opens): a short-break note on Today during maintenance,
  an "update" note when a newer version is out (closable), and a full-screen "time to update" when the server no longer
  accepts this version.
- **Pango Plus** (Me): every meal plan style with the week ahead and a shopping list, every training program and a
  year of trends, bought through Google Play. Everything else is
  free.

To check the model itself, open **Me > Model lab**, then:

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
- `npm test`: 214 tests, including that the JavaScript PNG decoder returns exactly the same pixels as
  Python/PIL for the golden photo (checked by hash), the output order and units, tensor checks and
  display rounding; for Pango, that every pose and outfit draws every visible part exactly once and renders;
  for the data layer, the real SQL schema (on sql.js) with sync against a fake server: two phones editing the
  same entry, edits made mid-sync, rejected changes, paging, the server asking for a full resync, offline backoff,
  token refresh, moving data to a new account; the goal formula pinned to the backend's own test numbers; and the
  screens driven like a user would: onboarding, Today, Add food, the camera (with a stand-in camera), the scan
  result (with the model's answer stubbed, as the model needs the phone), the barcode food screen, the diary,
  What fits, Progress, logging weight, the wardrobe's unlocks, Train, a workout from first set to saved session, the
  recap with sharing, Plus (without Google Play, as on the web), editing goals, and food search (recent meals, your
  own meals offline, the food list as you type, Open Food Facts on a tap, a food opened by id and again offline); plus the unlock rules, weight
  trends, recap maths, and workouts and goals syncing.
- `npm run test:backend`: the data layer against the real backend (`wrangler dev`): back up from one phone,
  restore, edit and delete on a second; onboarding answers stored with exactly the goals the phone worked out;
  scan records accepted; a workout session and goals set by hand stored (and the recommended goals restored); a
  server program joined and its next workout read into the app's shape; Plus status read; the profile read back;
  a day planned in each free meal plan style from the server's meals, and a planned meal synced.
- A web build (`npx expo export --platform web`) was screenshotted: Today, Me and Pango studio match the design
  canvas in dark and light, Pango's animations run, and they stop when the system asks for reduced motion. The
  data screens were walked through in it (add water, a form error, add and edit a meal, Me), and so were
  onboarding, the diary, What fits, Progress, Train, a workout (sets, rest, exercise done), Me, the wardrobe, Plus
  and the recap, offline, as browsers cannot reach the backend (it allows no web origins). The camera, the model and
  Google Play do not run in a browser.
- `npm run bundle-check`: Metro bundles the JavaScript to Hermes with the model and golden assets.
- `npx expo prebuild --platform android`: the plugins apply (GPU library entry, camera and photo
  permissions, microphone permission removed, New Architecture and Hermes on, the session kept out of Android's
  backups, billing pinned to Google Play) and SQLite, Secure Store, Crypto, Camera and billing (expo-iap) are linked.
- **The Android native build** (GitHub Actions, `.github/workflows/android.yml`): prebuild and
  `./gradlew assembleRelease` succeed with JDK 17, NDK 27.1 and SDK 37 (target 36), New Architecture and Hermes on.
  The job then checks the APK: package `io.lightarch.pango`, arm64 only, about 38 MB zipped; the JS bundle,
  the TFLite runtime (`libtensorflowlite_jni.so`, the GPU delegate and `libNitroTflite.so`) and the model, byte for
  byte, are inside; permissions are camera, internet, billing, vibrate, network state, biometrics (from Secure Store)
  and storage up to Android 12 (from the image picker); the microphone, phone-state and draw-over-apps permissions
  are blocked.
- The `.tflite` itself matches the PyTorch model to under 0.001 kcal/g on 260 real photos (ML repo).

**Not verified**: the app running on a phone: the model running on a device (CPU or GPU), the in-app camera,
barcode reading, the gallery flow, scan photos kept for the diary's thumbnails, whether the app's resizing matches
training closely enough, and SQLite, Secure Store and backup over Wi-Fi on a real phone. Specific risks:
- **Resizing.** Training squashed photos with PIL bilinear resizing; the phone resizes with its own
  library (the 256 px self-test measures this).
- **Photo orientation.** Whether camera photos arrive upright (EXIF rotation) was not checked.
- **GPU delegate** support for this model on your phone.
- **First launch** with the New Architecture and the Nitro modules library: it builds, but has not been opened.
- **Model loading in a standalone APK.** The app copies the bundled model out of the APK into the cache
  with `expo-asset` and gives the TFLite library a `file://` URL, because that library cannot read a bare
  Android resource name. This is reasoned from both libraries' source code and works in the bundle and
  prebuild checks, but has not run on a device. The golden photos are embedded in the code as base64 for
  the same reason (image assets resolve to drawable names in a standalone build).

## App structure

- `app/`: screens, by route (Expo Router). `(tabs)/` holds Today, Train, Progress and Me (shown only once
  onboarding is done). Pushed screens: `onboarding`, `lens` (camera), `scan` (scan result), `food` (barcode result),
  `add` (add or edit a meal), `diary`, `fits` (What fits?), `weigh` (weight or goal weight), `recap`, `program`,
  `workout`, `wardrobe`, `plus`, `goals`, `studio` and `lab`.
- `src/train/`: the built-in workouts (`library.ts`, written for this app) and the set logging helpers (`session.ts`).
- `src/plus/billing.ts`: Google Play Billing through expo-iap: prices, buying, acknowledging, restoring.
- `src/pango/wardrobe.ts` and `src/data/achievements.ts`: what can be worn, and the stats that unlock it.
- `src/scan/`: loading the model once, photo to estimate (`model.ts`), portions and what is saved and recorded
  (`scanMath.ts`), scan photos kept on the phone (`photos.ts`).
- `src/data/`: what the screens read and write (`repo.ts`), the sync engine (`sync.ts`), the provider and hooks
  (`DataProvider.tsx`, `hooks.ts`). `src/db/`: the phone's SQLite and its migrations. `src/auth/`: the session.
  `src/api/`: the typed backend client; `schema.d.ts` is generated from `api/openapi.json` by `npm run api:types`.
- `src/config.ts`: the backend address and app version.
- `src/theme/`: design tokens from the design canvas (colours for dark and light, spacing, radii, type), the theme
  provider and fonts (Plus Jakarta Sans, SIL Open Font License).
- `src/ui/`: shared pieces (Text, Button, Card, Chip, Segmented, ProgressBar, Ring, Icon, IconButton, Screen,
  TabBar, EmptyState). Touch targets are at least 44 points.
- `src/pango/`: the mascot (below).
- `src/lab/`: the original v1 screen's pieces, used by the Model lab (self-test and raw estimates).
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

- **Profile and goals** change on the phone at once (`src/data/profile.ts`) and are sent with the next sync.
- **Scan photos stay on the phone.** A downsized copy is kept in the app's own storage for the diary's thumbnails
  and deleted with the entry. What goes to the server for each scan is numbers only: what the model said, the food
  probability, the portion and what was saved (or that it was discarded), so the model's accuracy on real phone
  photos can be measured (`/v1/scans`).
- **Barcodes** are looked up by the backend: your own foods, then the shared catalogue, then Open Food Facts (its
  data is credited on the screen, as its licence requires). A product found this way joins the shared catalogue.
- **Food search** sends what you type to the backend (`/v1/foods/search`). Your own meals are matched on the phone.
  "Search Open Food Facts" sends the words straight from the phone to Open Food Facts (it is their search, with
  their limit of 10 a minute per person, so it never runs while you type). Foods you open are kept on the phone so a
  recent one opens offline.
- **Steps**: read from Health Connect only after you allow it (steps only, never written), and only while Pango is
  open. Each day's total, with its estimated distance and calories, is backed up like the diary (so Ask Pango can
  mention your walking). Take access back any time in Health Connect.
- **Ask Pango**: your messages go to the backend, which keeps the conversation for 90 days (in the data export, deleted
  with the account, "Start over" deletes it) and sends them to Cloudflare Workers AI with your goals and recent numbers.
  The grocery list stays on the phone; only the food ids go to the server when you ask for ideas.
- **Meal plans**: the style you pick, swaps and shopping ticks stay on the phone. A planned meal you log is an
  ordinary diary entry.
- **Workouts** are saved on the phone and synced like meals (`workout_session`). Energy burned is a rough estimate
  from standard MET values and your weight.
- **Wardrobe unlocks** are worked out from synced data (diary, water, workouts), so they follow you to a new phone.
  The look Pango wears is kept on the phone.
- **Deleting the account** holds syncing while it runs (`sync.hold`), so no round in between uploads the diary to a new
  account; then the server deletes everything and signs every device out, and the phone empties every table and its
  kept photos.
- **Plus**: Google Play sells the subscription; the app sends the purchase token to the server, which checks it with
  Google before granting anything, and only then acknowledges the purchase. The phone keeps the server's last answer
  for offline use. On a test server (stage says so with `testPurchases` in `/v1/config`) the Plus screen shows **Try
  Plus free (test server)** and, once on, **End test Plus**, so the paid parts can be tried without Google Play.
  Development builds show a "Test Plus" button for a local server. Production never allows either.

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

- The Android package id is `io.lightarch.pango` (`app.json`). It is permanent once on Google Play, so settle it before
  the first upload.
- The launcher icon, adaptive icon and splash are Pango (`scripts/make-icons.py`, from the design canvas's Sizes board).
  The app is called "Pango" (`app.json` `name`): check the name is free to use in the Play Store and as a trademark.
- Google Play also asks for a web page where people can request account deletion without the app (the in-app option is
  in Me > Your data). A page on the privacy policy's site that says "email us, or use Me > Your data" is enough.
- Choose a licence for this repo (none is set).
- Credit Nutrition5k in the app (shown on the main screen) and re-check the licence terms.
- Say plainly in the store listing that results are rough estimates, not medical or dietary advice.
- The privacy policy must cover the scan records (numbers per scan, linked to the account) and the profile facts
  (year of birth, height, weight, sex if given). Consider a setting to turn scan records off. It should also say that
  "Search Open Food Facts" sends the search words (and so the phone's internet address) to Open Food Facts.
- Open Food Facts asks apps to name a contact in their User-Agent: set `expo.extra.offUserAgent` in `app.json`, for
  example `"Pango/1.0 (support@lightarch.io)"`.
- Create the subscriptions in Play Console with the ids the backend expects (`pro_monthly`, `pro_yearly`), each with
  a base plan (and the trial as an offer if you want one), and add licence testers to try buying without being
  charged. Purchases only work in a build installed from Google Play (an internal testing track is enough).
- Product decision: the backend's placeholder free plan says 3 scans a day, but the design says scanning is always
  free, so the app does not limit scans. Change one or the other.
- Have someone check the built-in workouts' instructions before release.
- The local ideas in What fits use typical values for common dishes; have someone check them, or replace them with
  catalogue foods.
