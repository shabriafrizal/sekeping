# Rust core

Sekeping's domain logic lives in Rust and ships to the browser as WebAssembly.
The React UI is unchanged: it calls the same functions it used to, through
`src/lib/rust.ts`.

```text
src/                  React UI, Intl formatting, OCR, JEV client
  lib/rust.ts         loads the core once, before the first render
  wasm/               wasm-pack output (committed so npm builds work without Rust)
rust/
  crates/sekeping-core   pure domain logic, no DOM, no browser APIs
  crates/sekeping-wasm   JSON-string boundary used by the browser
  crates/sekeping-cli    `sekeping` command for backups and ledgers
  cases/                 behaviour recorded from the TypeScript reference
```

## What runs in Rust

| Area | Core module | Browser entry point |
| --- | --- | --- |
| Amounts, money parsing | `money.rs` | `receipt`, `csv` |
| Dates and calendar math | `dates.rs` | budgets, recurring |
| Budgets and rollover | `budgets.rs` | `src/lib/budgets.ts` |
| Recurring schedules | `recurring.rs` | `src/lib/recurring.ts` |
| CSV parse, map, validate | `csv.rs` | `src/lib/csv.ts` |
| Receipt reading | `receipt.rs` | `src/lib/receipt.ts` |
| Totals and CSV export | `reports.rs` | CLI, future report calls |
| Backup validation | `backup.rs` | CLI, WASM boundary |
| Encrypted backups | `crypto.rs` | `src/lib/crypto.ts` |

Currency, date and compact-number formatting stay in `src/lib/format.ts`. The
Rust versions are verified against `Intl` (see the golden cases) but the UI keeps
using the platform formatter so language and locale data never have to be copied
into the bundle.

## Build and test

```bash
cargo test --manifest-path rust/Cargo.toml      # core, vector and golden tests
cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings
npm run build:wasm                              # rebuild src/wasm
npm run build                                   # production UI + WASM
```

The committed `src/wasm` folder means a fresh clone can run `npm ci` and
`npm run build` without a Rust toolchain. Rebuild it whenever a crate changes.
`wasm-opt` is disabled in `sekeping-wasm/Cargo.toml` because the pinned binaryen
in some environments cannot validate the newer bulk-memory output; Vite still
minifies the surrounding JavaScript.

## Golden cases

`rust/cases/golden.json` records the old TypeScript behaviour for money, dates,
budgets, recurring schedules, CSV and the encrypted envelope. The Rust port
asserts against it in `crates/sekeping-core/tests/golden.rs`.

Regenerate after changing the reference implementation or the fixtures:

```bash
npm run cases
```

The recorder forces `TZ=UTC` so `Date`-based sort keys are deterministic. Run
the Node command with a recent Node (20+); WebCrypto is required for the envelope
fixture.

Receipt parsing is covered by Rust unit tests instead of golden cases. The
TypeScript parser had two bugs that the port fixes deliberately:

1. **Day-first dates above the 12th.** `19/11/2026` inverted day and month and
   fell back to today. The Rust parser flips only when the second part cannot be
   a day (`11/19/2026`).
2. **Destination detection.** The old check looked *after* the account name for
   `ke`/`tujuan`, so `Transfer ke Dompet` never marked `Dompet` as the
   destination. The Rust parser looks at the words before the name.

Both fixes are visible in the scan end-to-end test and in the receipt unit tests.

## Security notes

- Envelopes remain compatible with the browser: `sekeping-encrypted`, PBKDF2-SHA256
  with 310,000 iterations and AES-256-GCM.
- Decryption rejects iterations above 5,000,000 and salts shorter than 8 bytes,
  so an untrusted file cannot freeze the tab with an absurd KDF cost.
- CSV export prefixes cells that start with `=`, `+`, `-`, `@`, tab or carriage
  return with an apostrophe, preventing spreadsheet formula injection.
- The WASM boundary parses JSON defensively and returns errors instead of
  panicking. Unknown types, months and intervals are rejected.
- OCR images and receipt text never reach Rust through the network; the core is
  called in the same tab as the UI.

## Command line

```bash
cargo run -p sekeping-cli -- validate backup.json
cargo run -p sekeping-cli -- summary backup.json --text
cargo run -p sekeping-cli -- export-csv backup.json --out ledger.csv
cargo run -p sekeping-cli -- recurring-due backup.json --today 2026-11-20
SEKEPING_PASSWORD='…' cargo run -p sekeping-cli -- encrypt backup.json -o backup.sekeping
SEKEPING_PASSWORD='…' cargo run -p sekeping-cli -- decrypt backup.sekeping --pretty
```

`validate` exits `1` when a ledger has errors and `2` when the input cannot be
read. `encrypt` refuses to overwrite an existing file unless `--force` is given.

## Adding a new pure module

1. Put the logic in `crates/sekeping-core`, with unit tests next to it.
2. Keep JSON field names `camelCase` so browser backups load unchanged.
3. Export a JSON-string function from `crates/sekeping-wasm` and add it to
   `src/lib/rust.ts`'s typed surface.
4. Add a golden case if the TypeScript version still exists, then delete the
   TypeScript duplicate.
5. Run `cargo test`, `npm run build:wasm`, `npm run typecheck` and the browser
   suites before committing.
