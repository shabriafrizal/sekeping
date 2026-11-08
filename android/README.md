# Sekeping for Android

A thin native shell around the same web build, plus a resizable home-screen widget and
two Astryx dialogs that float over the launcher.

| Piece | File |
| --- | --- |
| WebView host, asset loader, deep links | `app/src/main/java/dev/shabri/sekeping/MainActivity.kt` |
| Shared WebView setup for the dialogs | `WebAppHost.kt` |
| Widget preferences, accounts and saldo summary | `WidgetPrefs.kt` |
| 4×1 / 4×2 / 2×2 widgets | `WidgetProvider.kt`, `res/layout/widget_sekeping_*.xml` |
| “Atur widget” dialog (web modal) | `WidgetConfigActivity.kt`, `src/sheets/WidgetConfigSheet.tsx` |
| Quick-add sheet over the home screen | `WidgetSheetActivity.kt` |

## How the pieces talk

1. The web app calls `window.SekepingWidget.setAccounts(json)` and `setSummary(json)`
   whenever accounts, transactions or the currency change. `MainActivity` stores both in
   `WidgetPrefs`, then refreshes every widget instance.
2. A widget button fires a `PendingIntent` for `WidgetSheetActivity` with `type` and
   `account` extras. The card itself opens `MainActivity`.
3. `WidgetSheetActivity` loads
   `…/index.html?sheet=<type>&account=<id>` in a transparent, dimmed dialog activity. The
   React app renders **only** the transaction sheet, anchored to the bottom of the window,
   and `closeSheet()` finishes the activity after saving or cancelling.
4. “Reconfigure” loads `…/index.html?widget_config=<id>` in `WidgetConfigActivity`. The
   same Astryx build renders the **Atur widget** dialog: account picker, action switches,
   and a live 4×1 / 4×2 / 2×2 preview. `getWidgetConfig()` seeds it and
   `saveWidgetConfig(json)` writes the choices, updates the widget and returns `RESULT_OK`.
5. Both dialog activities use `android:taskAffinity=""` and a translucent theme, so the
   launcher (not the dashboard) stays visible behind them.
6. Every surface uses the same `WebViewAssetLoader` origin, so the ledger in
   `localStorage` is shared. A `storage` listener plus a visibility check reload the state
   when the full app and the quick-add sheet are open at the same time.

## Widget sizes

The launcher's widget picker offers three entries, so the size is chosen **before**
placing the widget:

| Entry | Provider | Layout | Content |
| --- | --- | --- | --- |
| Sekeping 4×1 | `WidgetProviderWide` | `widget_sekeping_small.xml` | Provider, balance, total + three large icon actions |
| Sekeping 4×2 | `WidgetProvider` | `widget_sekeping_medium.xml` | Saldo, provider, total + labelled actions |
| Sekeping 2×2 | `WidgetProviderSquare` | `widget_sekeping_square.xml` | Provider, total + three square icon actions |

The four-by-two entry keeps its original resizable behaviour for people who already
have a widget from an older version. The fixed entries use `resizeMode="none"` and
pass their layout to `WidgetProvider.update()`. The setup dialog reads the actual size
through `getWidgetConfig()` and previews that shape; it no longer asks for a size.

Saldo and the month figures are formatted by the web app (`money()`), so the widget
uses the same currency and separators as the ledger. Fraunces is bundled as a static
semibold TTF for API 26+; API 24–25 fall back to the platform serif through
`values/styles.xml`.

## Data

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
