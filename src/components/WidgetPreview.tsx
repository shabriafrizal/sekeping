import type { ReactNode } from 'react';
import { iconFor } from '../lib/icons';

export type WidgetSize = '4x1' | '4x2' | '2x2';

export interface WidgetLabels {
  total: string;
  balance: string;
  provider: string;
  expense: string;
  income: string;
  transfer: string;
  empty: string;
  hide: string;
  show: string;
}

export function widgetLabels(language: string): WidgetLabels {
  if (language === 'en') {
    return {
      total: 'Total',
      balance: 'Balance',
      provider: 'Account',
      expense: 'Expense',
      income: 'Income',
      transfer: 'Transfer',
      empty: 'No account yet',
      hide: 'Hide amounts',
      show: 'Show amounts',
    };
  }
  return {
    total: 'Total',
    balance: 'Saldo',
    provider: 'Rekening',
    expense: 'Pengeluaran',
    income: 'Pendapatan',
    transfer: 'Transfer',
    empty: 'Belum ada rekening',
    hide: 'Sembunyikan nominal',
    show: 'Tampilkan nominal',
  };
}

interface Props {
  size: WidgetSize;
  providerName: string;
  providerIcon: string;
  providerBalance: string;
  total: string;
  masked: boolean;
  language: string;
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

function EyeGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
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

function Action({
  tone,
  label,
  children,
}: {
  tone: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="skw-action" data-tone={tone}>
      <span className="skw-action-icon">{children}</span>
      <span className="skw-action-label">{label}</span>
    </span>
  );
}

function mask(value: string, masked: boolean): string {
  return masked ? value.replace(/[\d.,]+/g, '***') : value;
}

/**
 * The home-screen widget, drawn in HTML so the setup dialog previews exactly
 * what the native RemoteViews layouts render.
 */
export default function WidgetPreview({
  size,
  providerName,
  providerIcon,
  providerBalance,
  total,
  masked,
  language,
  showExpense,
  showIncome,
  showTransfer,
}: Props) {
  const labels = widgetLabels(language);
  const ProviderIcon = iconFor(providerIcon);

  return (
    <div className="skw-stage" data-size={size}>
      <div className="skw-widget" data-size={size}>
        <div className="skw-main">
          <div className="skw-brand-row">
            <span className="skw-mark">
              <WalletGlyph />
            </span>
            <span className="skw-brand">Sekeping</span>
            <span className="skw-eye" title={labels.hide} aria-hidden="true">
              <EyeGlyph />
            </span>
          </div>

          <div className="skw-provider">
            <span className="skw-provider-icon">
              <ProviderIcon />
            </span>
            <span className="skw-provider-name">{providerName || labels.empty}</span>
          </div>

          <div className="skw-amounts">
            <span>
              <small>{labels.balance}</small>
              <b>{mask(providerBalance, masked)}</b>
            </span>
            <span>
              <small>{labels.total}</small>
              <b>{mask(total, masked)}</b>
            </span>
          </div>
        </div>

        <div className="skw-actions">
          {showExpense ? (
            <Action tone="expense" label={labels.expense}>
              <ExpenseGlyph />
            </Action>
          ) : null}
          {showIncome ? (
            <Action tone="income" label={labels.income}>
              <IncomeGlyph />
            </Action>
          ) : null}
          {showTransfer ? (
            <Action tone="transfer" label={labels.transfer}>
              <TransferGlyph />
            </Action>
          ) : null}
        </div>
      </div>
    </div>
  );
}
