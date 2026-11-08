# Contributing to Sekeping

Thanks for taking a look. Sekeping is a small, deliberately backend-free project:
React + TypeScript, a static build, and `localStorage` for data. Contributions that keep
it that way are very welcome.

## Before you start

- **Bug or small fix?** Open a pull request directly.
- **New feature or a behaviour change?** Open an issue first so we can agree on the shape.
- **Security issue?** Please do not open a public issue; email the maintainer listed on
  the repository profile.

## Development setup

```bash
git clone https://github.com/OWNER/sekeping.git
cd sekeping
npm install
npm run dev
```

Node.js 20+ and npm 10+ are required. The app needs no environment variables and no
services.

## Checks

Run these before opening a pull request:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm test            # browser smoke tests
```

The smoke tests need a preview server:

```bash
npm run build
npm run preview -- --port 4180 &
npm test
```

They use `puppeteer-core` with the system Chromium. Set `CHROME_PATH` if your browser
lives somewhere else.

## Code conventions

- TypeScript strict mode; no `any` unless a third-party type forces it.
- State changes go through the actions in `src/lib/store.tsx` — do not write
  `localStorage` from components.
- Money is stored as a whole number in the smallest unit of the selected currency
  (for IDR, rupiah). Never store formatted strings.
- Dates are `YYYY-MM-DD` strings in local time.
- New UI should use Astryx components and theme tokens; avoid raw hex values and one-off
  CSS when a token exists.
- Comments explain *why*, not *what*.

## Android module

`android/` is a Kotlin shell around the same web build, plus the home-screen widget.
It is not part of the npm build; the APK bundles `dist/`.

```bash
ANDROID_HOME=/path/to/android-sdk ./scripts/build-apk.sh
```

- Keep the WebView thin: business logic belongs in the web app, not in Kotlin.
- The widget only passes `type` and `account` to the app; it never writes data.
- If you change the bridge in `MainActivity.WidgetBridge`, update
  `src/lib/native.ts` and document the new method.
- Run `./gradlew lint` inside `android/` before opening a PR that touches Kotlin.

## Adding a currency

1. Add the code and symbol in `src/lib/format.ts`.
2. Add it to the selector options in `src/pages/Settings.tsx`.
3. Check that amounts and decimals render correctly in the dashboard, list and reports.

## Reporting a bug

Include the browser and version, the steps to reproduce, what you expected, and what
happened. If it involves a calculation, export a JSON backup and describe the values —
please remove anything personal first.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
