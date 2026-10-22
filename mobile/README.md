# Animora for Android

This is a thin Android app that opens the live Animora website. When you push a
website update to Vercel, the app shows it straight away. You do not need to
rebuild the APK for normal updates.

The app opens `https://animora-ivory.vercel.app/videos`. If your site address is
different, change `server.url` in `capacitor.config.json` before building.

## Option A: build with GitHub (no Android Studio)
1. Put `build-apk.yml` in `.github/workflows/` and push.
2. On GitHub open Actions, then "Build Android APK", then Run workflow.
3. When it finishes, download `animora-apk` from the run. Unzip it and send
   `app-debug.apk` to your phone. Allow "install unknown apps" when asked.

## Option B: build with Android Studio
1. Install Node 20 or newer and Android Studio.
2. In a terminal, from this `mobile` folder:
   ```
   npm install
   npm run add
   npm run assets
   npm run sync
   npm run open
   ```
3. In Android Studio choose Build, Build Bundle(s) / APK(s), Build APK(s).
   The file is `android/app/build/outputs/apk/debug/app-debug.apk`.

## Play Store
A debug APK is only for your own phone and testers. For the Play Store you need a
signed release bundle (Build, Generate Signed Bundle) and a Play developer account.
