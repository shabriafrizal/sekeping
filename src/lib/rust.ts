/**
 * The Rust core, loaded once at startup.
 *
 * The WebAssembly module is the single implementation of money, budgets,
 * recurring bills, CSV import, receipt parsing, reporting and encrypted
 * backups. React reads it through this module; UI formatting that needs
 * `Intl` stays in `format.ts`.
 */
import init, * as wasm from '../wasm/sekeping_wasm.js';

export type RustCore = typeof wasm;

let ready: RustCore | null = null;
let starting: Promise<RustCore> | null = null;

/** Fetch and instantiate the core before the first render. */
export async function initRust(): Promise<RustCore> {
  if (ready) return ready;
  if (!starting) {
    starting = init().then(() => {
      ready = wasm;
      return wasm;
    });
  }
  return starting;
}

/** True once `initRust()` has resolved. */
export function coreReady(): boolean {
  return ready !== null;
}

/** Synchronous access for components and event handlers after startup. */
export function core(): RustCore {
  if (!ready) throw new Error('rust-core-not-ready');
  return ready;
}

/** Parse a JSON string returned by the core, with a readable error. */
export function parseCoreJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`rust-core:${label}:${(error as Error).message}`);
  }
}
