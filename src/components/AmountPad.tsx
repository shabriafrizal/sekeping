import { useEffect } from 'react';
import { money } from '../lib/format';

interface AmountPadProps {
  value: number;
  onChange: (next: number) => void;
  currency: string;
  tone?: 'expense' | 'income' | 'transfer';
  /** Only capture global digit keys while the pad is actually on screen. */
  isActive?: boolean;
}

const QUICK = [
  { amount: 500, label: '500' },
  { amount: 1_000, label: '1 rb' },
  { amount: 2_000, label: '2 rb' },
  { amount: 5_000, label: '5 rb' },
  { amount: 10_000, label: '10 rb' },
  { amount: 25_000, label: '25 rb' },
  { amount: 50_000, label: '50 rb' },
  { amount: 100_000, label: '100 rb' },
];

export default function AmountPad({ value, onChange, currency, tone = 'expense', isActive = true }: AmountPadProps) {
  useEffect(() => {
    if (!isActive) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onChange(Math.min(value * 10 + Number(e.key), 999_999_999_999));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        onChange(Math.floor(value / 10));
      } else if (e.key === 'Escape') {
        /* let the dialog handle it */
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange, isActive]);

  const digit = (n: number) => onChange(Math.min(value * 10 + n, 999_999_999_999));
  const appendZeros = (zeros: number) => onChange(Math.min(value * 10 ** zeros, 999_999_999_999));

  return (
    <div className="sk-sheet">
      <div className="sk-amount-display">
        <p className="sk-eyebrow">Jumlah</p>
        <div className="sk-amount-value" data-tone={tone} aria-live="polite">
          {money(value, currency)}
        </div>
        <p className="sk-amount-hint">Ketuk angka atau ketik di keyboard</p>
      </div>

      <div className="sk-quick" role="group" aria-label="Jumlah cepat">
        {QUICK.map((q) => (
          <button key={q.amount} type="button" onClick={() => onChange(value + q.amount)}>
            +{q.label}
          </button>
        ))}
      </div>

      <div className="sk-keypad" role="group" aria-label="Papan angka">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" className="sk-key" onClick={() => digit(n)}>
            {n}
          </button>
        ))}
        <button type="button" className="sk-key" data-variant="util" onClick={() => appendZeros(3)}>
          000
        </button>
        <button type="button" className="sk-key" onClick={() => digit(0)}>
          0
        </button>
        <button
          type="button"
          className="sk-key"
          data-variant="util"
          aria-label="Hapus satu angka"
          onClick={() => onChange(Math.floor(value / 10))}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
