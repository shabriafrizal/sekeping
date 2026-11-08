import type { ReactNode } from 'react';
import { iconFor } from '../lib/icons';
import { t } from '../lib/i18n';

export type WidgetSize = '4x1' | '4x2' | '2x2';

export interface WidgetLabels {
  total: string;
  totalAll: string;
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
      totalAll: 'All accounts total',
      balance: 'Balance',
      provider: 'Account',
      expense: 'Expense',
      income: 'Income',
      transfer: t("Transfer"),
      empty: 'No account yet',
      hide: 'Hide amounts',
      show: 'Show amounts',
    };
  }
  return {
    total: t("Total"),
    totalAll: t("Total semua rekening"),
    balance: 'Saldo',
    provider: t("Rekening"),
    expense: t("Pengeluaran"),
    income: t("Pendapatan"),
    transfer: t("Transfer"),
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

/* Glyph geometry matches the vector drawables in android/app/src/main/res/drawable,
   with the same stroke weights, so the preview and the launcher read the same. */

function ExpenseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 18 18 6M8.5 6H18v9.5"
        stroke="currentColor"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IncomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6 6 18M15.5 18H6V8.5"
        stroke="currentColor"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TransferGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5h15M15 4.5l4 4-4 4M20 15.5H5M9 11.5l-4 4 4 4"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeGlyph({ masked }: { masked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12S5.8 5.2 12 5.2 22 12 22 12 18.2 18.8 12 18.8 2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      {masked ? <path d="M4 4 20 20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /> : null}
    </svg>
  );
}

function Action({
  tone,
  label,
  withLabel,
  children,
}: {
  tone: string;
  label: string;
  withLabel: boolean;
  children: ReactNode;
}) {
  return (
    <span className="skw-action" data-tone={tone}>
      <span className="skw-action-icon">{children}</span>
      {withLabel ? <span className="skw-action-label">{label}</span> : null}
    </span>
  );
}

function mask(value: string, masked: boolean): string {
  return masked ? value.replace(/[\d.,]+/g, '***') : value;
}

/**
 * The home-screen widget, drawn in HTML so the setup dialog previews the same
 * structure as the native RemoteViews layouts in each size.
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
  const balance = mask(providerBalance, masked);
  const totalValue = mask(total, masked);
  const withLabels = size === '4x2';
  const totalLabel = size === '4x2' ? labels.totalAll : labels.total;

  return (
    <div className="skw-stage" data-size={size}>
      <div className="skw-widget" data-size={size}>
        <div className="skw-main">
          <div className="skw-head">
            <span className="skw-provider-icon">
              <ProviderIcon />
            </span>
            <span className="skw-provider-name">{providerName || labels.empty}</span>
            {withLabels ? <span className="skw-balance">{balance}</span> : null}
            <span className="skw-eye" title={masked ? labels.show : labels.hide} aria-hidden="true">
              <EyeGlyph masked={masked} />
            </span>
          </div>

          <div className="skw-amounts">
            {withLabels ? null : (
              <span className="skw-amount-row">
                <b className="skw-balance">{balance}</b>
              </span>
            )}
            <span className="skw-amount-row skw-total">
              <small>{totalLabel}</small>
              <b>{totalValue}</b>
            </span>
          </div>
        </div>

        <div className="skw-actions">
          {showExpense ? (
            <Action tone="expense" label={labels.expense} withLabel={withLabels}>
              <ExpenseGlyph />
            </Action>
          ) : null}
          {showIncome ? (
            <Action tone="income" label={labels.income} withLabel={withLabels}>
              <IncomeGlyph />
            </Action>
          ) : null}
          {showTransfer ? (
            <Action tone="transfer" label={labels.transfer} withLabel={withLabels}>
              <TransferGlyph />
            </Action>
          ) : null}
        </div>
      </div>
    </div>
  );
}
