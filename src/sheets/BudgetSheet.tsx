import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { useStore } from '../lib/store';
import type { Budget } from '../lib/types';
import { currentMonthKey } from '../lib/budgets';

export function BudgetSheet({
  isOpen,
  onOpenChange,
  budget,
  initialCategoryId,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  initialCategoryId?: string;
}) {
  const { state, addBudget, updateBudget, removeBudget, notify } = useStore();
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState(0);
  const [rollover, setRollover] = useState(true);
  const [startMonth, setStartMonth] = useState(currentMonthKey());
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setCategoryId(budget?.categoryId ?? initialCategoryId ?? state.categories.find((c) => c.type === 'expense')?.id ?? '');
    setAmount(budget?.amount ?? 0);
    setRollover(budget?.rollover ?? true);
    setStartMonth(budget?.startMonth ?? currentMonthKey());
    setActive(budget?.active ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, budget, initialCategoryId]);

  const options = useMemo(
    () => state.categories.filter((c) => c.type === 'expense').map((c) => ({ value: c.id, label: c.name })),
    [state.categories],
  );

  const duplicate = state.budgets.find((b) => b.categoryId === categoryId && b.id !== budget?.id);

  function save() {
    if (!categoryId) {
      notify('Pilih kategori.', 'error');
      return;
    }
    if (amount <= 0) {
      notify('Isi batas anggaran lebih dari nol.', 'error');
      return;
    }
    if (duplicate) {
      notify('Kategori ini sudah punya anggaran.', 'error');
      return;
    }
    const payload = { categoryId, amount, rollover, startMonth, active };
    if (budget) {
      updateBudget(budget.id, payload);
      notify('Anggaran diperbarui');
    } else {
      addBudget(payload);
      notify('Anggaran ditambahkan');
    }
    onOpenChange(false);
  }

  function destroy() {
    if (!budget) return;
    removeBudget(budget.id);
    notify('Anggaran dihapus', 'info');
    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={430} maxHeight="90dvh">
      <DialogHeader
        title={budget ? 'Ubah anggaran' : 'Buat anggaran'}
        subtitle="Batas pengeluaran bulanan"
        onOpenChange={onOpenChange}
      />
      <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
        <Selector
          label="Kategori"
          options={options}
          value={categoryId}
          onChange={setCategoryId}
          width="100%"
        />
        <TextInput
          label="Batas per bulan"
          value={amount ? String(amount) : ''}
          placeholder="0"
          onChange={(v) => setAmount(Number(v.replace(/\D/g, '')) || 0)}
        />
        <label className="sk-field">
          <span className="sk-eyebrow">Mulai bulan</span>
          <input
            className="sk-input"
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          />
        </label>
        <label className="sk-check">
          <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
          <span>
            <b>Rollover bulanan</b>
            <small>Sisa anggaran yang tidak terpakai ditambahkan ke jatah bulan berikutnya.</small>
          </span>
        </label>
        <label className="sk-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>
            <b>Aktif</b>
            <small>Anggaran nonaktif disembunyikan dari daftar dan ringkasan.</small>
          </span>
        </label>
        {duplicate ? (
          <p className="sk-sub" style={{ color: 'var(--color-error)', fontSize: '0.78rem', margin: 0 }}>
            Kategori ini sudah punya anggaran. Ubah yang sudah ada agar rollover-nya tetap benar.
          </p>
        ) : null}
      </div>
      <div className="sk-sheet-actions">
        {budget ? (
          <Button label="Hapus" variant="destructive" onClick={destroy} />
        ) : (
          <Button label="Batal" variant="ghost" onClick={() => onOpenChange(false)} />
        )}
        <Button label="Simpan" variant="primary" onClick={save} isDisabled={Boolean(duplicate)} />
      </div>
    </Dialog>
  );
}
