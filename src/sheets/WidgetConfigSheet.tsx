import { useMemo, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { Switch } from '@astryxdesign/core/Switch';
import { useStore, currentMonth } from '../lib/store';
import { money } from '../lib/format';
import { iconFor } from '../lib/icons';
import WidgetPreview, { type WidgetSize } from '../components/WidgetPreview';
import { closeSheet, openApp, readWidgetConfig, saveWidgetConfig } from '../lib/native';

const SIZES: Array<{ id: WidgetSize; label: string; hint: string }> = [
  { id: '4x1', label: '4×1', hint: 'Ringkas' },
  { id: '4x2', label: '4×2', hint: 'Lengkap' },
  { id: '2x2', label: '2×2', hint: 'Kotak' },
];

/**
 * The "Atur widget" dialog. It runs inside the APK's configuration activity,
 * on top of the same Astryx theme as the app, and previews the exact widget
 * layouts in 4×1, 4×2 and 2×2 before saving to the host.
 */
export default function WidgetConfigSheet({ locked }: { locked: boolean }) {
  const { state, netWorth, balanceOf } = useStore();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initial = useMemo(
    () => readWidgetConfig(Number(params.get('widget_config')) || 0),
    [params],
  );

  const language = state.settings.language;
  const L =
    language === 'en'
      ? {
          title: 'Widget setup',
          subtitle: 'Pick the account, buttons and size.',
          preview: 'Preview',
          saved: 'Saved',
          sizes: { '4x1': 'Compact', '4x2': 'Full', '2x2': 'Square' },
          sizeAria: 'Widget size',
          sizeHint: 'The size follows the space you give it on the home screen.',
          account: 'Account',
          noAccounts: 'Open Sekeping once so the account list appears here.',
          openApp: 'Open app',
          accountHint:
            'This account is preselected when you add from the widget. The second amount is the total of every active account.',
          actions: 'Buttons shown',
          expense: 'Expense',
          expenseHint: 'Record money out',
          income: 'Income',
          incomeHint: 'Record money in',
          transfer: 'Transfer',
          transferHint: 'Move between accounts',
          cancel: 'Cancel',
          save: 'Save',
        }
      : {
          title: 'Atur widget',
          subtitle: 'Pilih rekening, tombol, dan ukuran.',
          preview: 'Pratinjau',
          saved: 'Tersimpan',
          sizes: { '4x1': 'Ringkas', '4x2': 'Lengkap', '2x2': 'Kotak' },
          sizeAria: 'Ukuran widget',
          sizeHint: 'Ukuran mengikuti berapa banyak ruang yang kamu beri di layar utama.',
          account: 'Rekening',
          noAccounts: '{L.noAccounts}',
          openApp: 'Buka aplikasi',
          accountHint:
            'Rekening ini menjadi pilihan awal saat mencatat dari widget. Nominal kedua adalah total semua rekening aktif.',
          actions: 'Tombol yang tampil',
          expense: 'Pengeluaran',
          expenseHint: 'Catat uang keluar',
          income: 'Pendapatan',
          incomeHint: 'Catat uang masuk',
          transfer: 'Transfer',
          transferHint: 'Pindah antar rekening',
          cancel: 'Batal',
          save: 'Simpan',
        };

  const activeAccounts = state.accounts.filter((a) => a.active);
  const [accountId, setAccountId] = useState(
    initial.accountId && activeAccounts.some((a) => a.id === initial.accountId)
      ? initial.accountId
      : activeAccounts[0]?.id ?? '',
  );
  const provider = activeAccounts.find((a) => a.id === accountId) ?? activeAccounts[0];
  const [showExpense, setShowExpense] = useState(initial.showExpense);
  const [showIncome, setShowIncome] = useState(initial.showIncome);
  const [showTransfer, setShowTransfer] = useState(initial.showTransfer);
  const [size, setSize] = useState<WidgetSize>('4x1');
  const [saved, setSaved] = useState(false);

  const { from, to } = currentMonth();
  const totals = state.txs.reduce(
    (acc, tx) => {
      if (tx.date < from || tx.date > to) return acc;
      if (tx.type === 'income') acc.income += tx.amount;
      if (tx.type === 'expense') acc.expense += tx.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const balance = locked ? 'Rp ••••••' : money(netWorth, state.settings.currency);
  const canSave = activeAccounts.length === 0 || Boolean(accountId);

  function save() {
    saveWidgetConfig({
      widgetId: initial.widgetId,
      accountId,
      showExpense,
      showIncome,
      showTransfer,
    });
    setSaved(true);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) closeSheet();
      }}
      purpose="form"
      width={440}
      maxHeight="94dvh"
    >
      <DialogHeader
        title={L.title}
        subtitle={L.subtitle}
        onOpenChange={() => closeSheet()}
      />

      <div className="sk-dialog-body">
        <div className="sk-widget-config">
          <section className="skw-section" aria-labelledby="skw-preview-title">
            <div className="skw-section-head">
              <p className="sk-eyebrow" id="skw-preview-title">
                {L.preview}
              </p>
              <span className="skw-save-note" data-visible={saved}>
                {L.saved}
              </span>
            </div>

            <div className="skw-tabs" role="tablist" aria-label={L.sizeAria}>
              {SIZES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={size === item.id}
                  className="skw-tab"
                  data-active={size === item.id}
                  onClick={() => setSize(item.id)}
                >
                  <strong>{item.label}</strong>
                  <small>{L.sizes[item.id]}</small>
                </button>
              ))}
            </div>

            <WidgetPreview
              size={size}
              providerName={provider?.name ?? ''}
              providerIcon={provider?.icon ?? 'wallet'}
              providerBalance={money(balanceOf(provider?.id ?? ''), state.settings.currency)}
              total={money(netWorth, state.settings.currency)}
              masked={locked}
              language={language}
              showExpense={showExpense}
              showIncome={showIncome}
              showTransfer={showTransfer}
            />
            <p className="skw-hint">{L.sizeHint}</p>
          </section>

          <section className="skw-section" aria-labelledby="skw-account-title">
            <p className="sk-eyebrow" id="skw-account-title">
              {L.account}
            </p>
            {activeAccounts.length > 0 ? (
              <RadioList
                label={L.account}
                isLabelHidden
                value={accountId}
                onChange={setAccountId}
                width="100%"
                size="sm"
              >
                {activeAccounts.map((account) => {
                  const Icon = iconFor(account.icon);
                  return (
                    <RadioListItem
                      key={account.id}
                      value={account.id}
                      label={account.name}
                      startContent={
                        <span className="sk-account-icon">
                          <Icon />
                        </span>
                      }
                    />
                  );
                })}
              </RadioList>
            ) : (
              <div className="skw-empty">
                <p>{L.noAccounts}</p>
                <Button label={L.openApp} variant="secondary" onClick={openApp} />
              </div>
            )}
            <p className="skw-hint">
              {L.accountHint}
            </p>
          </section>

          <section className="skw-section" aria-labelledby="skw-actions-title">
            <p className="sk-eyebrow" id="skw-actions-title">
              {L.actions}
            </p>
            <div className="skw-toggles">
              <div className="skw-toggle">
                <span className="skw-action" data-tone="expense" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="skw-toggle-copy">
                  <strong>{L.expense}</strong>
                  <small>{L.expenseHint}</small>
                </span>
                <Switch
                  label={L.expense}
                  isLabelHidden
                  value={showExpense}
                  onChange={setShowExpense}
                />
              </div>

              <div className="skw-toggle">
                <span className="skw-action" data-tone="income" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M17 7 7 17M15 17H7V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="skw-toggle-copy">
                  <strong>{L.income}</strong>
                  <small>{L.incomeHint}</small>
                </span>
                <Switch
                  label={L.income}
                  isLabelHidden
                  value={showIncome}
                  onChange={setShowIncome}
                />
              </div>

              <div className="skw-toggle">
                <span className="skw-action" data-tone="transfer" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 9h13m-4-4 4 4-4 4M20 15H7m4 4-4-4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="skw-toggle-copy">
                  <strong>{L.transfer}</strong>
                  <small>{L.transferHint}</small>
                </span>
                <Switch
                  label={L.transfer}
                  isLabelHidden
                  value={showTransfer}
                  onChange={setShowTransfer}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="sk-sheet-actions sk-widget-footer">
        <Button label={L.cancel} variant="ghost" onClick={closeSheet} />
        <Button label={L.save} variant="primary" onClick={save} isDisabled={!canSave} />
      </div>
    </Dialog>
  );
}
