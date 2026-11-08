/**
 * Bridge to the Android host. The APK injects a `SekepingWidget` object; in a
 * normal browser it is undefined and every call is a no-op.
 *
 * Two native surfaces reuse this build:
 * - `?sheet=expense&account=acc_x` — the quick-add sheet shown over the home
 *   screen by a transparent activity, without opening the dashboard.
 * - `?widget_config=<id>` — the "Atur widget" dialog shown while configuring a
 *   home-screen widget.
 */

export type NativeMode = 'sheet' | 'config' | null;

export function nativeMode(): NativeMode {
  const value = document.documentElement.dataset.native;
  return value === 'sheet' || value === 'config' ? value : null;
}

export interface NativeAccount {
  id: string;
  name: string;
}

export interface NativeWidgetConfig {
  widgetId: number;
  accountId: string;
  showExpense: boolean;
  showIncome: boolean;
  showTransfer: boolean;
}

export interface NativeWidgetAccount {
  id: string;
  name: string;
  icon: string;
  /** Formatted balance of this account. */
  balance: string;
}

export interface NativeWidgetSummary {
  /** Formatted net worth, e.g. "Rp 43.479.500". */
  total: string;
  /** Formatted money in this month, e.g. "+Rp 3.200.000". */
  monthIn: string;
  /** Formatted money out this month, e.g. "−Rp 1.651.000". */
  monthOut: string;
  /** ISO code of the display currency. */
  currency: string;
  /** "id" or "en" — the widget reuses the app language. */
  language: string;
  /** Active accounts with their own balances, in display order. */
  accounts: NativeWidgetAccount[];
}

export interface NativeWidgetBridge {
  setAccounts: (json: string) => void;
  setSummary: (json: string) => void;
  ready: () => void;
  getWidgetConfig?: () => string;
  saveWidgetConfig?: (json: string) => void;
  closeSheet?: () => void;
  openApp?: () => void;
  toast?: (message: string) => void;
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

export function syncWidgetSummary(summary: NativeWidgetSummary): void {
  try {
    window.SekepingWidget?.setSummary(JSON.stringify(summary));
  } catch {
    /* no-op outside the APK */
  }
}

export function signalReady(): void {
  try {
    window.SekepingWidget?.ready();
  } catch {
    /* no-op */
  }
}

/** Current widget choices, pushed by the host when the config dialog opens. */
export function readWidgetConfig(fallbackId: number): NativeWidgetConfig {
  const fallback: NativeWidgetConfig = {
    widgetId: fallbackId,
    accountId: '',
    showExpense: true,
    showIncome: true,
    showTransfer: true,
  };
  try {
    const raw = window.SekepingWidget?.getWidgetConfig?.();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<NativeWidgetConfig>;
    return {
      widgetId: Number(parsed.widgetId) || fallbackId,
      accountId: typeof parsed.accountId === 'string' ? parsed.accountId : '',
      showExpense: parsed.showExpense !== false,
      showIncome: parsed.showIncome !== false,
      showTransfer: parsed.showTransfer !== false,
    };
  } catch {
    return fallback;
  }
}

export function saveWidgetConfig(config: NativeWidgetConfig): void {
  try {
    window.SekepingWidget?.saveWidgetConfig?.(JSON.stringify(config));
  } catch {
    /* no-op in a browser preview */
  }
}

/** Dismiss the quick-add activity after saving or cancelling. */
export function closeSheet(): void {
  try {
    window.SekepingWidget?.closeSheet?.();
  } catch {
    /* no-op */
  }
}

/** Leave the modal and hand control to the full app. */
export function openApp(): void {
  try {
    window.SekepingWidget?.openApp?.();
  } catch {
    /* no-op */
  }
}

export function toast(message: string): void {
  try {
    window.SekepingWidget?.toast?.(message);
  } catch {
    /* no-op */
  }
}
