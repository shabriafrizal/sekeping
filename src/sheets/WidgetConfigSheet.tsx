import { useMemo, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { Switch } from '@astryxdesign/core/Switch';
import { useStore, currentMonth } from '../lib/store';
import { currencySymbol, money } from '../lib/format';
import { iconFor } from '../lib/icons';
import WidgetPreview from '../components/WidgetPreview';
import { closeSheet, openApp, readWidgetConfig, saveWidgetConfig } from '../lib/native';
import { t } from '../lib/i18n';

/**
 * The "Atur widget" dialog. It runs inside the APK's configuration activity,
 * on top of the same Astryx theme as the app. The launcher already asked which
 * size to add, so this only previews that size and edits its account/buttons.
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
          subtitle: 'Pick the account and buttons.',
          preview: 'Preview',
          saved: 'Saved',
          sizes: { '4x1': 'Compact', '4x2': 'Full', '2x2': 'Square' },
          sizeHint: 'This is the size you picked in the launcher.',
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
          transfer: t("Transfer"),
          transferHint: 'Move between accounts',
          cancel: 'Cancel',
          save: 'Save',
        }
      : {
          title: 'Atur widget',
          subtitle: 'Pilih rekening dan tombol.',
          preview: 'Pratinjau',
          saved: 'Tersimpan',
          sizes: { '4x1': 'Ringkas', '4x2': 'Lengkap', '2x2': 'Kotak' },
          sizeHint: 'Ukuran ini yang kamu pilih dari layar utama.',
          account: t("Rekening"),
          noAccounts: 'Buka Sekeping sekali agar daftar rekening muncul di sini.',
          openApp: 'Buka aplikasi',
          accountHint:
            'Rekening ini menjadi pilihan awal saat mencatat dari widget. Nominal kedua adalah total semua rekening aktif.',
          actions: 'Tombol yang tampil',
          expense: t("Pengeluaran"),
          expenseHint: 'Catat uang keluar',
          income: t("Pendapatan"),
          incomeHint: 'Catat uang masuk',
          transfer: t("Transfer"),
          transferHint: 'Pindah antar rekening',
          cancel: t("Batal"),
          save: t("Simpan"),
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
  const size = initial.size ?? '4x2';
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

  const balance = locked
    ? `${currencySymbol(state.settings.currency)} ••••••`
    : money(netWorth, state.settings.currency);
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

            <p className="skw-size">
              <strong>{size.replace('x', '×')}</strong>
              <span>{L.sizes[size]}</span>
            </p>

            <WidgetPreview
              size={size}
              providerName={provider?.name ?? ''}
              providerIcon={provider?.icon ?? 'wallet'}
              providerBalance={money(balanceOf(provider?.id ?? ''), state.settings.currency)}
              total={money(netWorth, state.settings.currency)}
              masked={locked || initial.amountsHidden === true}
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
                <span className="skw-tile" data-tone="expense" aria-hidden="true">
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
                <span className="skw-tile" data-tone="income" aria-hidden="true">
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
                <span className="skw-tile" data-tone="transfer" aria-hidden="true">
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
