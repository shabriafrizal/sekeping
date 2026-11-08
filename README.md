<p align="center">
  <img src="docs/logo.svg" width="72" height="72" alt="Sekeping logo">
</p>

<h1 align="center">Sekeping</h1>

<p align="center"><strong>A calm personal-finance web app.</strong><br>
Track accounts, spending, transfers, reports, debts and receivables — in the browser, with no sign-up and no server.</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2F6B57"></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-2F6B57">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-2F6B57">
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-2F6B57"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="docs/dashboard.png" width="900" alt="Sekeping dashboard: total balance, accounts, recent transactions and a seven-day spending chart">
</p>

## About

Sekeping (*a coin*, in Indonesian) is a local-first notebook for your money. Most
finance apps ask you to create an account, sync to a cloud, and hand over your spending
history. Sekeping does the opposite: it is a static site, the data lives in your
browser's `localStorage`, and nothing is uploaded anywhere.

It is built for people who want a fast, quiet ledger — a few accounts, daily expenses,
the occasional transfer, a monthly report, and a reminder of who owes whom.

**What makes it different**

- **Zero backend.** Clone it, build it, host it on any static host. No database, no auth service.
- **Instant.** One small bundle, self-hosted fonts, no network calls after load.
- **Yours.** Export everything to CSV or a JSON backup at any time; restore it on another device.
- **Complete enough.** Accounts, categories, transfers with fees, reports, debts, loans, PIN lock.

## Features

| Area | What you get |
| --- | --- |
| **Dashboard** | Total balance across active accounts, monthly in/out, saving rate, 7-day spend chart, recent activity, top categories |
| **Transactions** | Search, filter by type / account / category / period, grouped by day with daily totals, detail view with edit and delete |
| **Entry** | Expense, income or transfer; amount keypad (keyboard input too), account and category pickers, date, note, transfer fee |
| **Reports** | Category donut, ranked category bars, six-month trend, expense/income toggle, period switch |
| **Debts & receivables** | Paid vs remaining progress, due dates, overdue state, payment entries that post to the ledger |
| **Settings** | Profile and currency, account and category CRUD with icon picker, PIN lock, CSV export, JSON backup/restore, demo reset |
| **Responsive** | Sidebar on desktop; bottom tab bar and floating add button on phones |

## Quick start

### Run it locally

```bash
git clone https://github.com/shabriafrizal/sekeping.git
cd sekeping
npm install
npm run dev
```

Open the printed URL (usually <http://localhost:5173>). On first visit you can load a
demo dataset or start from an empty ledger.

**Requirements:** Node.js 20 or newer, npm 10 or newer, and any modern browser.

### Use the hosted preview

A temporary build runs at **<https://4175-agq3odpinhs2pqpojgekdx5pvq.instabox.tech>**
while its host is up. For something permanent, deploy your own copy — see [Deploy](#deploy).

## Usage

### Record a transaction

1. Press **Tambah transaksi** in the sidebar (or the **+** tab on mobile).
2. Choose **Pengeluaran**, **Pendapatan** or **Transfer**.
3. Type the amount with the keypad, or just type the digits on your keyboard.
4. Pick an account and a category, then **Simpan**.

### Move money between accounts

Choose **Transfer**, set the source and destination account and, if your bank charges
one, the admin fee. Transfers never count as income or spending in reports.

### Read your month

**Laporan** shows a category donut and a ranked list for the selected period, plus a
six-month trend. Toggle between spending and income at the top. Periods: this month,
three months, this year, or everything.

### Track debts and loans

**Utang & Piutang** keeps both sides of a loan: what you owe and what you are owed.
Each card shows the remaining amount, a progress bar and the due date. Recording a
payment creates a matching transaction, so the ledger and the debt record stay in sync.

### Lock it and back it up

- **Pengaturan → Keamanan** sets a 4-digit PIN. It guards the screen on this device; it
  is not encryption.
- **Pengaturan → Data** exports a CSV of all transactions or a complete JSON backup. Use
  **Pulihkan** to restore a backup file.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `0`–`9` | Append the digit to the amount |
| `Backspace` | Remove the last digit |
| `Esc` | Close the open dialog |

## Screenshots

| Transactions | Reports |
| --- | --- |
| ![Transaction list with daily totals](docs/transactions.png) | ![Category donut and six-month trend](docs/reports.png) |

| New transaction | Mobile |
| --- | --- |
| ![Amount keypad, account and category pickers](docs/add-transaction.png) | ![Mobile dashboard with bottom tab bar](docs/mobile.png) |

## How it works

State is a single object in `localStorage` under `sekeping.state.v1`:

```ts
type AppState = {
  accounts: Account[];      // name, icon, opening balance, active flag
  categories: Category[];   // name, icon, expense | income, active flag
  txs: Tx[];                // expense | income | transfer, amount, account, category, date, note
  debts: Debt[];            // debt | loan, total, due date
  payments: DebtPayment[];  // payments against a debt, each mirrored into txs
  settings: Settings;       // name, currency, PIN, onboarding flag
};
```

Three rules keep the numbers honest:

1. **Balance** = opening balance + income − expenses + incoming transfers − outgoing
   transfers − fees.
2. **Reports** ignore transfers between your own accounts, so moving money is not
   counted as spending.
3. **A debt payment** writes both a `DebtPayment` and a linked `Tx`, so deleting the
   transaction removes the payment and vice versa.

There is no sync layer by design. Clearing site data clears the app — take a JSON
backup first.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript |
| Build | Vite 6 |
| Design system | [Astryx](https://astryx.design) (Chocolate base, extended with a custom palette and type scale) |
| Charts | Recharts |
| Icons | Heroicons |
| Fonts | Fraunces + Albert Sans, self-hosted woff2 (OFL) |
| Storage | `localStorage` — no backend |

## Project structure

```text
src/
  App.tsx              shell, navigation, dialogs, onboarding, PIN lock
  theme.ts             Astryx theme: warm paper, moss green, Fraunces headings
  lib/
    types.ts           domain types
    store.tsx          state, actions, selectors, persistence
    seed.ts            demo dataset
    format.ts          currency, dates, helpers
  components/          amount keypad, icon picker, transaction row, empty state
  pages/               Home, Transactions, Reports, Debts, Settings
  sheets/              transaction, account, category, debt and payment dialogs
scripts/
  test.mjs             14 browser smoke tests
  shots.mjs            screenshot set for the docs
```

## Development

```bash
npm run dev       # development server with hot reload
npm run build     # production build into dist/
npm run preview   # serve the production build on :4173
npm run typecheck # tsc --noEmit
```

### Tests

The smoke tests drive a real Chromium against a preview build and cover onboarding,
adding a transaction, search, deleting, PIN set → reload → unlock, persistence, charts
and the payment dialog.

```bash
npm run build
npm run preview -- --port 4180 &
npm test
```

`scripts/test.mjs` uses `puppeteer-core` and the system Chromium (`/usr/bin/chromium`).
Set `CHROME_PATH` if yours lives elsewhere.

## Deploy

`npm run build` emits a static `dist/` with relative asset paths, so it works at a
domain root or in a subdirectory:

| Host | Setting |
| --- | --- |
| Vercel / Netlify / Cloudflare Pages | Build `npm run build`, output `dist` |
| GitHub Pages | Publish `dist/` (relative `base` already handles the `/repo/` path) |
| Any static server | Copy `dist/` and serve it |

No environment variables are required.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then open an
issue to discuss anything larger than a bug fix.

```bash
git clone https://github.com/shabriafrizal/sekeping.git
cd sekeping
npm install
npm run dev
```

Good places to start:

- Additional currencies and number formats
- Recurring transactions
- Budgets per category
- Import from bank CSV exports
- Accessibility review of the dialogs and keypad

Please keep the project backend-free — local-first is the point.

## Roadmap

- [ ] Recurring transactions and subscriptions
- [ ] Per-category budgets with monthly rollover
- [ ] CSV import with column mapping
- [ ] Optional encrypted export
- [ ] Full keyboard navigation audit

## Acknowledgments

- [Astryx](https://astryx.design) for the design system and theme tooling
- [Recharts](https://recharts.org), [Heroicons](https://heroicons.com)
- Fraunces and Albert Sans, served under the SIL Open Font License
- The feature set was mapped by statically analysing a published Android finance app;
  this codebase, its name, palette, copy and screens are original. No code or assets
  from that app are included.

## License

Sekeping is released under the [MIT License](LICENSE).
