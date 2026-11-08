/**
 * Bridge to the Android host. The APK injects a `SekepingWidget` object; in a
 * normal browser it is undefined and every call is a no-op.
 */

export interface NativeAccount {
  id: string;
  name: string;
}

export interface NativeWidgetBridge {
  setAccounts: (json: string) => void;
  ready: () => void;
}

declare global {
  interface Window {
    SekepingWidget?: NativeWidgetBridge;
    SekepingOpenAdd?: (type: string, accountId: string | null) => void;
  }
}

export function syncWidgetAccounts(accounts: Array<{ id: string; name: string; active: boolean }>): void {
  try {
    const payload: NativeAccount[] = accounts.filter((a) => a.active).map(({ id, name }) => ({ id, name }));
    window.SekepingWidget?.setAccounts(JSON.stringify(payload));
  } catch {
    /* not running inside the Android shell */
  }
}

export function signalReady(): void {
  try {
    window.SekepingWidget?.ready();
  } catch {
    /* no-op */
  }
}
