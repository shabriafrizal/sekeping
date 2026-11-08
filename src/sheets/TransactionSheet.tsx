import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { useStore } from '../lib/store';
import type { Tx, TxType } from '../lib/types';
import { nowTime, parseAmountInput, todayISO } from '../lib/format';
import { iconFor } from '../lib/icons';
import AmountPad from '../components/AmountPad';
import { t } from '../lib/i18n';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tx?: Tx | null;
  initialType?: TxType;
  initialAccountId?: string;
  /** Native surfaces show the confirmation outside the WebView. */
  onSaved?: (message: string) => void;
}

const TYPE_LABEL: Record<TxType, string> = {
  expense: t("Pengeluaran"),
  income: t("Pendapatan"),
  transfer: t("Transfer"),
};

export default function TransactionSheet({ isOpen, onOpenChange, tx = null, initialType, initialAccountId, onSaved }: Props) {
  const store = useStore();
  const { state, addTx, updateTx, removeTx, notify } = store;

  const [type, setType] = useState<TxType>(initialType ?? 'expense');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [toAccountId, setToAccountId] = useState(state.accounts[1]?.id ?? '');
  const [fee, setFee] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (tx) {
      setType(tx.type);
      setAmount(tx.amount);
      setAccountId(tx.accountId);
      setCategoryId(tx.categoryId ?? '');
      setToAccountId(tx.toAccountId ?? state.accounts[1]?.id ?? '');
      setFee(tx.fee ?? 0);
      setDate(tx.date);
      setTime(tx.time ?? '');
      setNote(tx.note);
    } else {
      const t = initialType ?? 'expense';
      setType(t);
      setAmount(0);
      const preferred = initialAccountId && state.accounts.some((a) => a.id === initialAccountId && a.active)
        ? initialAccountId
        : state.accounts.find((a) => a.active)?.id ?? state.accounts[0]?.id ?? '';
      setAccountId(preferred);
      setCategoryId('');
      setToAccountId(state.accounts.find((a) => a.active && a.id !== state.accounts[0]?.id)?.id ?? '');
      setFee(0);
      setDate(todayISO());
      setTime(nowTime());
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tx, initialAccountId]);

  const categories = useMemo(
    () => state.categories.filter((c) => c.active && c.type === (type === 'income' ? 'income' : 'expense')),
    [state.categories, type],
  );

  useEffect(() => {
    if (type === 'transfer') return;
    if (categoryId && categories.some((c) => c.id === categoryId)) return;
    setCategoryId(categories[0]?.id ?? '');
  }, [categories, categoryId, type]);

  const accountOptions = state.accounts
    .filter((a) => a.active)
    .map((a) => {
      const Icon = iconFor(a.icon);
      return { value: a.id, label: a.name, icon: Icon };
    });

  const canSave =
    amount > 0 &&
    Boolean(accountId) &&
    (type === 'transfer' ? Boolean(toAccountId) && toAccountId !== accountId : Boolean(categoryId));

  function submit() {
    if (!canSave) {
      notify('Lengkapi jumlah dan pilih rekening/kategori.', 'error');
      return;
    }
    const payload = {
      type,
      amount,
      accountId,
      categoryId: type === 'transfer' ? undefined : categoryId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      fee: type === 'transfer' ? fee : 0,
      date,
      time: time || undefined,
      note: note.trim(),
    };
    if (tx) {
      updateTx(tx.id, payload);
      notify('Transaksi diperbarui');
      onSaved?.('Transaksi diperbarui');
    } else {
      addTx(payload);
      const message =
        type === 'expense' ? 'Pengeluaran dicatat' : type === 'income' ? 'Pendapatan dicatat' : 'Transfer dicatat';
      notify(message);
      onSaved?.(message);
    }
    onOpenChange(false);
  }

  function destroy() {
    if (!tx) return;
    removeTx(tx.id);
    notify('Transaksi dihapus', 'info');
    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={460} maxHeight="92dvh">
      <DialogHeader
        title={tx ? 'Ubah transaksi' : t("Tambah transaksi")}
        subtitle={TYPE_LABEL[type]}
        onOpenChange={onOpenChange}
      />
      <div className="sk-dialog-body">
      <div className="sk-sheet">
        <div className="sk-type-row" role="radiogroup" aria-label={t("Jenis transaksi")}>
          {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className="sk-type-btn"
              data-tone={t}
              data-active={type === t}
              onClick={() => setType(t)}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <AmountPad value={amount} onChange={setAmount} currency={state.settings.currency} tone={type} isActive={isOpen} />

        <div className="sk-field">
          <Selector
            label={type === 'transfer' ? 'Dari rekening' : t("Rekening")}
            options={accountOptions}
            value={accountId}
            onChange={setAccountId}
            width="100%"
          />
        </div>

        {type === 'transfer' ? (
          <>
            <div className="sk-field">
              <Selector
                label={t("Ke rekening")}
                options={accountOptions.filter((o) => o.value !== accountId)}
                value={toAccountId}
                onChange={setToAccountId}
                width="100%"
              />
            </div>
            <div className="sk-field">
              <TextInput
                label={t("Biaya admin")}
                value={fee ? String(fee) : ''}
                placeholder="0"
                inputMode="decimal"
                onChange={(v) => setFee(parseAmountInput(v, state.settings.currency))}
              />
            </div>
          </>
        ) : (
          <div className="sk-field">
            <p className="sk-eyebrow" style={{ marginBottom: '0.45rem' }}>{t("Kategori")}</p>
            <div className="sk-cat-grid" role="radiogroup" aria-label={t("Kategori")}>
              {categories.map((c) => {
                const Icon = iconFor(c.icon);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={categoryId === c.id}
                    className="sk-cat-pill"
                    data-active={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                  >
                    <Icon />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="sk-two">
          <label className="sk-field">
            <span className="sk-eyebrow">{t("Tanggal")}</span>
            <input className="sk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="sk-field">
            <span className="sk-eyebrow">{t("Waktu · opsional")}</span>
            <input className="sk-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <TextInput label={t("Catatan")} value={note} placeholder={t("Opsional")} onChange={setNote} />
      </div>
      </div>

      <div className="sk-sheet-actions">
        {tx ? (
          <Button label={t("Hapus")} variant="destructive" onClick={destroy} />
        ) : (
          <Button label={t("Batal")} variant="ghost" onClick={() => onOpenChange(false)} />
        )}
        <Button label={tx ? 'Simpan perubahan' : t("Simpan")} variant="primary" onClick={submit} isDisabled={!canSave} />
      </div>
    </Dialog>
  );
}
