# Sekeping for Android

A thin native shell around the same web build, plus a home-screen widget.

| Piece | File |
| --- | --- |
| WebView host, asset loader, deep links | `app/src/main/java/dev/shabri/sekeping/MainActivity.kt` |
| 4×1 widget with three quick actions | `WidgetProvider.kt` |
| Setup popup (account + visible buttons) | `WidgetConfigActivity.kt` |
| Shared preferences shared by both | `WidgetPrefs.kt` |

## How the pieces talk

1. The web app calls `window.SekepingWidget.setAccounts(json)` whenever accounts change.
   `MainActivity` stores that list for the setup popup.
2. A widget button fires a `PendingIntent` with `type` and `account` extras.
3. `MainActivity` opens the WebView with `?add=<type>&account=<id>`, or calls
   `window.SekepingOpenAdd(...)` when the app is already running.
4. The site is served through `WebViewAssetLoader` at
   `https://appassets.androidplatform.net/assets/www/index.html`, so ES modules and
   `localStorage` behave exactly like on the web, offline.

Data lives in the WebView's own storage. It is not shared with the hosted site and is
removed when the app is uninstalled.

## Build

```bash
# from the repository root
ANDROID_HOME=/path/to/android-sdk ./scripts/build-apk.sh
```

Requirements: JDK 17+, Android SDK platform 34, build-tools 34.0.0, Node 20+.

The script builds the web app, copies `dist/` into `app/src/main/assets/www/`, and runs
`assembleRelease`. Output:

```
android/app/build/outputs/apk/release/app-release.apk
```

`./gradlew assembleDebug` works too, if the assets have been copied at least once.
