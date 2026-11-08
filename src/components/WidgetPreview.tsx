import type { ReactNode } from 'react';

export type WidgetSize = '4x1' | '4x2' | '2x2';

interface Props {
  size: WidgetSize;
  balance: string;
  monthIn: string;
  monthOut: string;
  accounts: number;
  showExpense: boolean;
  showIncome: boolean;
  showTransfer: boolean;
}

function WalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 8.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M4.5 9.8h11.2a1 1 0 0 1 1 1v2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.4" cy="13.4" r="1.3" fill="#E2B15A" />
    </svg>
  );
}

function ExpenseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IncomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17 7 7 17M15 17H7V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TransferGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9h13m-4-4 4 4-4 4M20 15H7m4 4-4-4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Action({ tone, label, children }: { tone: string; label: string; children: ReactNode }) {
  return (
    <span className="skw-action" data-tone={tone} role="img" aria-label={label} title={label}>
      {children}
    </span>
  );
}

/**
 * The home-screen widget, drawn in HTML so the setup dialog previews exactly
 * what the native RemoteViews layouts render (and so docs and tests can see it
 * without an emulator).
 */
export default function WidgetPreview({
  size,
  balance,
  monthIn,
  monthOut,
  accounts,
  showExpense,
  showIncome,
  showTransfer,
}: Props) {
  return (
    <div className="skw-stage" data-size={size}>
      <div className="skw-widget" data-size={size}>
        <div className="skw-main">
          <div className="skw-brand-row">
            <span className="skw-mark">
              <WalletGlyph />
            </span>
            <span className="skw-brand">Sekeping</span>
            <span className="skw-sub">{accounts > 0 ? `${accounts} rekening` : 'Belum ada rekening'}</span>
          </div>

          <div className="skw-balance">
            <span className="skw-label">Saldo</span>
            <strong className="skw-amount">{balance}</strong>
          </div>

          {size === '4x2' ? (
            <div className="skw-stats">
              <span>
                <small>Masuk</small>
                <b data-tone="income">{monthIn}</b>
              </span>
              <span>
                <small>Keluar</small>
                <b data-tone="expense">{monthOut}</b>
              </span>
            </div>
          ) : null}
        </div>

        <div className="skw-actions">
          {showExpense ? (
            <Action tone="expense" label="Pengeluaran">
              <ExpenseGlyph />
            </Action>
          ) : null}
          {showIncome ? (
            <Action tone="income" label="Pendapatan">
              <IncomeGlyph />
            </Action>
          ) : null}
          {showTransfer ? (
            <Action tone="transfer" label="Transfer">
              <TransferGlyph />
            </Action>
          ) : null}
        </div>
      </div>
    </div>
  );
}
