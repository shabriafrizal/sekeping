import { useEffect, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { useStore } from '../lib/store';
import type { Account, Category, CategoryType, Debt, DebtKind } from '../lib/types';
import { todayISO } from '../lib/format';
import { IconPicker } from '../components/IconPicker';
import { t } from '../lib/i18n';

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

export function AccountSheet({
  isOpen,
  onOpenChange,
  account,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  account?: Account | null;
}) {
  const { addAccount, updateAccount, removeAccount, notify, state } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('cash');
  const [initial, setInitial] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setName(account?.name ?? '');
    setIcon(account?.icon ?? 'cash');
    setInitial(account?.initial ?? 0);
    setActive(account?.active ?? true);
  }, [isOpen, account]);

  function save() {
    if (!name.trim()) {
      notify('Nama rekening wajib diisi.', 'error');
      return;
    }
    if (account) {
      updateAccount(account.id, { name: name.trim(), icon, initial, active });
      notify('Rekening diperbarui');
    } else {
      addAccount({ name: name.trim(), icon, initial, active });
      notify('Rekening ditambahkan');
    }
    onOpenChange(false);
  }

  function destroy() {
    if (!account) return;
    if (state.accounts.length <= 1) {
      notify('Minimal satu rekening harus ada.', 'error');
      return;
    }
    removeAccount(account.id);
    notify('Rekening dan transaksinya dihapus', 'info');
    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={430} maxHeight="90dvh">
      <DialogHeader
        title={t(account ? 'Ubah rekening' : 'Tambah rekening')}
        subtitle={t("Tempat uangmu disimpan")}
        onOpenChange={onOpenChange}
      />
      <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
        <TextInput label={t("Nama rekening")} value={name} placeholder={t("Cash, BCA, GoPay…")} onChange={setName} />
        <div className="sk-field">
          <TextInput
            label={t("Saldo awal")}
            value={initial ? String(initial) : ''}
            placeholder="0"
            onChange={(v) => setInitial(Number(v.replace(/\D/g, '')) || 0)}
          />
        </div>
        <IconPicker value={icon} onChange={setIcon} />
        <label className="sk-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>
            <b>{t("Aktif")}</b>
            <small>{t("Rekening tidak aktif disembunyikan saat mencatat transaksi.")}</small>
          </span>
        </label>
      </div>
      <div className="sk-sheet-actions">
        {account ? (
          <Button label={t("Hapus")} variant="destructive" onClick={destroy} />
        ) : (
          <Button label={t("Batal")} variant="ghost" onClick={() => onOpenChange(false)} />
        )}
        <Button label={t("Simpan")} variant="primary" onClick={save} />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Category                                                            */
/* ------------------------------------------------------------------ */

export function CategorySheet({
  isOpen,
  onOpenChange,
  category,
  initialType = 'expense',
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  category?: Category | null;
  initialType?: CategoryType;
}) {
  const { addCategory, updateCategory, removeCategory, notify } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('bag');
  const [type, setType] = useState<CategoryType>(initialType);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? (initialType === 'income' ? 'briefcase' : 'bag'));
    setType(category?.type ?? initialType);
    setActive(category?.active ?? true);
  }, [isOpen, category, initialType]);

  function save() {
    if (!name.trim()) {
      notify('Nama kategori wajib diisi.', 'error');
      return;
    }
    if (category) {
      updateCategory(category.id, { name: name.trim(), icon, type, active });
      notify('Kategori diperbarui');
    } else {
      addCategory({ name: name.trim(), icon, type, active });
      notify('Kategori ditambahkan');
    }
    onOpenChange(false);
  }

  function destroy() {
    if (!category) return;
    removeCategory(category.id);
    notify('Kategori dihapus', 'info');
    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={430} maxHeight="90dvh">
      <DialogHeader
        title={t(category ? 'Ubah kategori' : 'Tambah kategori')}
        subtitle={t("Kelompokkan transaksimu")}
        onOpenChange={onOpenChange}
      />
      <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
        <div className="sk-type-row" role="radiogroup" aria-label={t("Jenis kategori")}>
          <button
            type="button"
            className="sk-type-btn"
            data-tone="expense"
            data-active={type === 'expense'}
            aria-checked={type === 'expense'}
            role="radio"
            onClick={() => setType('expense')}
          >{t("Pengeluaran")}</button>
          <button
            type="button"
            className="sk-type-btn"
            data-tone="income"
            data-active={type === 'income'}
            aria-checked={type === 'income'}
            role="radio"
            onClick={() => setType('income')}
          >{t("Pendapatan")}</button>
        </div>
        <TextInput label={t("Nama kategori")} value={name} placeholder="Makan & Minum" onChange={setName} />
        <IconPicker value={icon} onChange={setIcon} />
        <label className="sk-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>
            <b>{t("Aktif")}</b>
            <small>{t("Kategori tidak aktif disembunyikan saat mencatat transaksi.")}</small>
          </span>
        </label>
      </div>
      <div className="sk-sheet-actions">
        {category ? (
          <Button label={t("Hapus")} variant="destructive" onClick={destroy} />
        ) : (
          <Button label={t("Batal")} variant="ghost" onClick={() => onOpenChange(false)} />
        )}
        <Button label={t("Simpan")} variant="primary" onClick={save} />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Debt / Loan                                                         */
/* ------------------------------------------------------------------ */

export function DebtSheet({
  isOpen,
  onOpenChange,
  debt,
  kind = 'debt',
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  debt?: Debt | null;
  kind?: DebtKind;
}) {
  const { addDebt, updateDebt, removeDebt, addTx, notify, state } = useStore();
  const [form, setForm] = useState({
    kind,
    name: '',
    note: '',
    total: 0,
    accountId: state.accounts[0]?.id ?? '',
    startDate: todayISO(),
    dueDate: '',
  });
  const [bookNow, setBookNow] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      kind: debt?.kind ?? kind,
      name: debt?.name ?? '',
      note: debt?.note ?? '',
      total: debt?.total ?? 0,
      accountId: debt?.accountId ?? state.accounts[0]?.id ?? '',
      startDate: debt?.startDate ?? todayISO(),
      dueDate: debt?.dueDate ?? '',
    });
    setBookNow(!debt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, debt, kind]);

  const options = state.accounts.filter((a) => a.active).map((a) => ({ value: a.id, label: a.name }));

  function save() {
    if (!form.name.trim() || form.total <= 0) {
      notify('Isi nama dan jumlah pinjaman.', 'error');
      return;
    }
    const payload = { ...form, name: form.name.trim(), dueDate: form.dueDate || undefined };
    if (debt) {
      updateDebt(debt.id, payload);
      notify('Catatan diperbarui');
    } else {
      addDebt(payload);
      if (bookNow) {
        addTx({
          type: form.kind === 'debt' ? 'income' : 'expense',
          amount: form.total,
          accountId: form.accountId,
          date: form.startDate,
          note: `${form.kind === 'debt' ? 'Dana pinjaman' : 'Pinjaman diberikan'}: ${form.name.trim()}`,
        });
      }
      notify(form.kind === 'debt' ? 'Utang dicatat' : 'Piutang dicatat');
    }
    onOpenChange(false);
  }

  function destroy() {
    if (!debt) return;
    removeDebt(debt.id);
    notify('Catatan dihapus', 'info');
    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440} maxHeight="92dvh">
      <DialogHeader
        title={t(debt ? 'Ubah catatan' : form.kind === 'debt' ? 'Catat utang' : 'Catat piutang')}
        subtitle={t(form.kind === 'debt' ? 'Uang yang kamu pinjam' : 'Uang yang kamu pinjamkan')}
        onOpenChange={onOpenChange}
      />
      <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
        <div className="sk-type-row" role="radiogroup" aria-label={t("Jenis")}>
          <button
            type="button"
            role="radio"
            aria-checked={form.kind === 'debt'}
            className="sk-type-btn"
            data-tone="expense"
            data-active={form.kind === 'debt'}
            onClick={() => setForm((f) => ({ ...f, kind: 'debt' }))}
          >{t("Utang")}</button>
          <button
            type="button"
            role="radio"
            aria-checked={form.kind === 'loan'}
            className="sk-type-btn"
            data-tone="income"
            data-active={form.kind === 'loan'}
            onClick={() => setForm((f) => ({ ...f, kind: 'loan' }))}
          >{t("Piutang")}</button>
        </div>
        <TextInput
          label={t("Nama")}
          value={form.name}
          placeholder={form.kind === 'debt' ? 'Pinjaman motor' : 'Dipinjam Rani'}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
        />
        <TextInput
          label={t("Jumlah")}
          value={form.total ? String(form.total) : ''}
          placeholder="0"
          onChange={(v) => setForm((f) => ({ ...f, total: Number(v.replace(/\D/g, '')) || 0 }))}
        />
        <Selector
          label={t("Rekening")}
          options={options}
          value={form.accountId}
          onChange={(v) => setForm((f) => ({ ...f, accountId: v }))}
          width="100%"
        />
        <div className="sk-two">
          <label className="sk-field">
            <span className="sk-eyebrow">{t("Tanggal mulai")}</span>
            <input
              className="sk-input"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </label>
          <label className="sk-field">
            <span className="sk-eyebrow">{t("Jatuh tempo")}</span>
            <input
              className="sk-input"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </label>
        </div>
        <TextInput
          label={t("Catatan")}
          value={form.note}
          placeholder={t("Opsional")}
          onChange={(v) => setForm((f) => ({ ...f, note: v }))}
        />
        {!debt ? (
          <label className="sk-check">
            <input type="checkbox" checked={bookNow} onChange={(e) => setBookNow(e.target.checked)} />
            <span>
              <b>{t("Catat di rekening sekarang")}</b>
              <small>
                {form.kind === 'debt'
                  ? t('Tambahkan pemasukan sebesar pinjaman ke rekening.')
                  : t('Tambahkan pengeluaran sebesar pinjaman ke rekening.')}
              </small>
            </span>
          </label>
        ) : null}
      </div>
      <div className="sk-sheet-actions">
        {debt ? (
          <Button label={t("Hapus")} variant="destructive" onClick={destroy} />
        ) : (
          <Button label={t("Batal")} variant="ghost" onClick={() => onOpenChange(false)} />
        )}
        <Button label={t("Simpan")} variant="primary" onClick={save} />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Debt payment                                                        */
/* ------------------------------------------------------------------ */

export function PaymentSheet({
  isOpen,
  onOpenChange,
  debt,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  debt: Debt | null;
}) {
  const { addPayment, notify, state } = useStore();
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen || !debt) return;
    setAmount(0);
    setAccountId(debt.accountId || state.accounts[0]?.id || '');
    setDate(todayISO());
    setNote('');
  }, [isOpen, debt, state.accounts]);

  if (!debt) return null;
  const options = state.accounts.filter((a) => a.active).map((a) => ({ value: a.id, label: a.name }));

  function save() {
    if (amount <= 0) {
      notify('Isi jumlah pembayaran.', 'error');
      return;
    }
    addPayment({ debtId: debt!.id, amount, accountId, date, note: note.trim() });
    notify(debt!.kind === 'debt' ? 'Pembayaran dicatat' : 'Pengembalian dicatat');
    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={420}>
      <DialogHeader
        title={debt.kind === 'debt' ? 'Bayar utang' : 'Catat pengembalian'}
        subtitle={debt.name}
        onOpenChange={onOpenChange}
      />
      <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
        <TextInput
          label={t("Jumlah")}
          value={amount ? String(amount) : ''}
          placeholder="0"
          onChange={(v) => setAmount(Number(v.replace(/\D/g, '')) || 0)}
        />
        <Selector
          label={t("Rekening")}
          options={options}
          value={accountId}
          onChange={setAccountId}
          width="100%"
        />
        <label className="sk-field">
          <span className="sk-eyebrow">{t("Tanggal")}</span>
          <input className="sk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <TextInput label={t("Catatan")} value={note} placeholder={t("Opsional")} onChange={setNote} />
      </div>
      <div className="sk-sheet-actions">
        <Button label={t("Batal")} variant="ghost" onClick={() => onOpenChange(false)} />
        <Button label={t("Simpan")} variant="primary" onClick={save} />
      </div>
    </Dialog>
  );
}
