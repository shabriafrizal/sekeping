import { useEffect } from 'react';
import { compactNumber, currencyHasCents, money } from '../lib/format';
import { t } from '../lib/i18n';

interface AmountPadProps {
  value: number;
  onChange: (next: number) => void;
  currency: string;
  tone?: 'expense' | 'income' | 'transfer';
  /** Only capture global digit keys while the pad is actually on screen. */
  isActive?: boolean;
}

/** Twelve digits is 999,999,999,999 minor units — more than any ledger needs. */
const MAX_DIGITS = 12;
const MAX = Number('9'.repeat(MAX_DIGITS));

export default function AmountPad({ value, onChange, currency, tone = 'expense', isActive = true }: AmountPadProps) {
  const cents = currencyHasCents(currency);
  const factor = cents ? 100 : 1;
  const digits = Math.max(0, Math.round(value * factor));

  const quick = cents ? [1, 5, 10, 50] : [1_000, 5_000, 10_000, 50_000];

  function setDigits(next: number) {
    onChange(next / factor);
  }

  function appendDigit(n: number) {
    setDigits(Math.min(digits * 10 + n, MAX));
  }

  function backspace() {
    setDigits(Math.floor(digits / 10));
  }

  function clear() {
    onChange(0);
  }

  useEffect(() => {
    if (!isActive) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDigit(Number(e.key));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        clear();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, factor, isActive, onChange]);

  return (
    <div className="sk-sheet">
      <div className="sk-amount-display">
        <p className="sk-eyebrow">{t("Jumlah")}</p>
        <div className="sk-amount-value" data-tone={tone} aria-live="polite">
          {money(value, currency)}
        </div>
        <p className="sk-amount-hint">
          {cents ? t("Ketik angka; dua digit terakhir adalah sen") : t("Ketuk angka atau ketik di keyboard")}
        </p>
      </div>

      <div className="sk-quick" role="group" aria-label={t("Jumlah cepat")}>
        {quick.map((amount) => (
          <button key={amount} type="button" onClick={() => onChange(value + amount)}>
            +{compactNumber(amount)}
          </button>
        ))}
      </div>

      <div className="sk-keypad" role="group" aria-label={t("Papan angka")}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" className="sk-key" onClick={() => appendDigit(n)}>
            {n}
          </button>
        ))}

        <button
          type="button"
          className="sk-key"
          data-variant="util"
          aria-label={t("Hapus semua angka")}
          onClick={clear}
        >
          AC
        </button>

        <button type="button" className="sk-key" onClick={() => appendDigit(0)}>
          0
        </button>

        <button
          type="button"
          className="sk-key"
          data-variant="util"
          aria-label={t("Hapus satu angka")}
          onClick={backspace}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
