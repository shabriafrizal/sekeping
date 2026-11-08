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
  const { state, netWorth } = useStore();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initial = useMemo(
    () => readWidgetConfig(Number(params.get('widget_config')) || 0),
    [params],
  );

  const activeAccounts = state.accounts.filter((a) => a.active);
  const [accountId, setAccountId] = useState(
    initial.accountId && activeAccounts.some((a) => a.id === initial.accountId)
      ? initial.accountId
      : activeAccounts[0]?.id ?? '',
  );
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
        title="Atur widget"
        subtitle="Pilih rekening, tombol, dan ukuran."
        onOpenChange={() => closeSheet()}
      />

      <div className="sk-dialog-body">
        <div className="sk-widget-config">
          <section className="skw-section" aria-labelledby="skw-preview-title">
            <div className="skw-section-head">
              <p className="sk-eyebrow" id="skw-preview-title">
                Pratinjau
              </p>
              <span className="skw-save-note" data-visible={saved}>
                Tersimpan
              </span>
            </div>

            <div className="skw-tabs" role="tablist" aria-label="Ukuran widget">
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
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>

            <WidgetPreview
              size={size}
              balance={balance}
              monthIn={locked ? '+Rp ••••' : `+${money(totals.income, state.settings.currency)}`}
              monthOut={locked ? '−Rp ••••' : `−${money(totals.expense, state.settings.currency)}`}
              accounts={activeAccounts.length}
              showExpense={showExpense}
              showIncome={showIncome}
              showTransfer={showTransfer}
            />
            <p className="skw-hint">Ukuran mengikuti berapa banyak ruang yang kamu beri di layar utama.</p>
          </section>

          <section className="skw-section" aria-labelledby="skw-account-title">
            <p className="sk-eyebrow" id="skw-account-title">
              Rekening
            </p>
            {activeAccounts.length > 0 ? (
              <RadioList
                label="Rekening"
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
                <p>Buka Sekeping sekali agar daftar rekening muncul di sini.</p>
                <Button label="Buka aplikasi" variant="secondary" onClick={openApp} />
              </div>
            )}
            <p className="skw-hint">
              Rekening ini menjadi pilihan awal saat mencatat dari widget. Saldo di widget adalah total semua rekening aktif.
            </p>
          </section>

          <section className="skw-section" aria-labelledby="skw-actions-title">
            <p className="sk-eyebrow" id="skw-actions-title">
              Tombol yang tampil
            </p>
            <div className="skw-toggles">
              <div className="skw-toggle">
                <span className="skw-action" data-tone="expense" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="skw-toggle-copy">
                  <strong>Pengeluaran</strong>
                  <small>Catat uang keluar</small>
                </span>
                <Switch
                  label="Pengeluaran"
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
                  <strong>Pendapatan</strong>
                  <small>Catat uang masuk</small>
                </span>
                <Switch
                  label="Pendapatan"
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
                  <strong>Transfer</strong>
                  <small>Pindah antar rekening</small>
                </span>
                <Switch
                  label="Transfer"
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
        <Button label="Batal" variant="ghost" onClick={closeSheet} />
        <Button label="Simpan" variant="primary" onClick={save} isDisabled={!canSave} />
      </div>
    </Dialog>
  );
}
