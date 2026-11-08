import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { useStore } from '../lib/store';
import type { Interval, Recurring } from '../lib/types';
import { parseAmountInput, todayISO } from '../lib/format';
import { advanceDate, initialNextDate } from '../lib/recurring';
import { t } from '../lib/i18n';

export function RecurringSheet({
  isOpen,
  onOpenChange,
  item,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: Recurring | null;
}) {
  const { state, addRecurring, updateRecurring, removeRecurring, postRecurring, skipRecurring, notify } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [interval, setInterval] = useState<Interval>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [nextDate, setNextDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [isSubscription, setIsSubscription] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const today = todayISO();
    if (item) {
      setName(item.name);
      setType(item.type);
      setAmount(item.amount);
      setAccountId(item.accountId);
      setCategoryId(item.categoryId ?? '');
      setInterval(item.interval);
      setStartDate(item.startDate);
      setNextDate(item.nextDate);
      setEndDate(item.endDate ?? '');
      setIsSubscription(item.isSubscription);
      setActive(item.active);
    } else {
      setName('');
      setType('expense');
      setAmount(0);
      setAccountId(state.accounts.find((a) => a.active)?.id ?? state.accounts[0]?.id ?? '');
      setCategoryId('');
      setInterval('monthly');
      setStartDate(today);
      setNextDate(today);
      setEndDate('');
      setIsSubscription(false);
      setActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item]);

  const accountOptions = state.accounts.filter((a) => a.active).map((a) => ({ value: a.id, label: a.name }));
  const categories = useMemo(
    () => state.categories.filter((c) => c.active && c.type === type),
    [state.categories, type],
  );

  useEffect(() => {
    if (categoryId && categories.some((c) => c.id === categoryId)) return;
    setCategoryId(categories[0]?.id ?? '');
  }, [categories, categoryId]);

  const intervalOptions = [
    { value: 'weekly', label: t("Mingguan") },
    { value: 'monthly', label: t("Bulanan") },
    { value: 'yearly', label: t("Tahunan") },
  ];

  function save() {
    if (!name.trim() || amount <= 0 || !accountId) {
      notify('Isi nama, jumlah, dan rekening.', 'error');
      return;
    }
    const payload = {
      name: name.trim(),
      type,
      amount,
      accountId,
      categoryId: categoryId || undefined,
      note: item?.note ?? name.trim(),
      interval,
      startDate,
      nextDate: nextDate || initialNextDate(startDate, interval),
      endDate: endDate || undefined,
      active,
      isSubscription,
    };
    if (item) {
      updateRecurring(item.id, payload);
      notify('Jadwal diperbarui');
    } else {
      addRecurring(payload);
      notify('Jadwal ditambahkan');
    }
    onOpenChange(false);
  }

  function destroy() {
    if (!item) return;
    removeRecurring(item.id);
    notify('Jadwal dihapus; transaksi lama tetap ada', 'info');
    onOpenChange(false);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={460} maxHeight="92dvh">
      <DialogHeader
        title={item ? 'Ubah jadwal' : t("Tambah jadwal")}
        subtitle={t("Transaksi berulang & langganan")}
        onOpenChange={onOpenChange}
      />
      <div className="sk-dialog-body">
        <div className="sk-sheet">
          <div className="sk-type-row" role="radiogroup" aria-label={t("Jenis transaksi")}>
            {([
              ['expense', t("Pengeluaran")],
              ['income', t("Pendapatan")],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                className="sk-type-btn"
                data-tone={value}
                data-active={type === value}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <TextInput
            label={t("Nama jadwal")}
            value={name}
            placeholder={t("Netflix, sewa kos, gaji…")}
            onChange={setName}
          />
          <TextInput
            label={t("Jumlah")}
            value={amount ? String(amount) : ''}
            placeholder="0"
            inputMode="decimal"
            onChange={(v) => setAmount(parseAmountInput(v, state.settings.currency))}
          />

          <Selector
            label={t("Rekening")}
            options={accountOptions}
            value={accountId}
            onChange={setAccountId}
            width="100%"
          />
          <Selector
            label={t("Kategori")}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={setCategoryId}
            width="100%"
          />
          <Selector
            label={t("Ulangi setiap")}
            options={intervalOptions}
            value={interval}
            onChange={(v) => {
              const next = v as Interval;
              setInterval(next);
              if (!item) setNextDate(initialNextDate(startDate, next));
            }}
            width="100%"
          />

          <div className="sk-two">
            <label className="sk-field">
              <span className="sk-eyebrow">{t("Mulai")}</span>
              <input
                className="sk-input"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!item) setNextDate(initialNextDate(e.target.value, interval));
                }}
              />
            </label>
            <label className="sk-field">
              <span className="sk-eyebrow">{t("Jatuh tempo berikutnya")}</span>
              <input
                className="sk-input"
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </label>
          </div>
          <label className="sk-field">
            <span className="sk-eyebrow">{t("Berakhir (opsional)")}</span>
            <input className="sk-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <p className="sk-sub" style={{ fontSize: '0.74rem', margin: 0 }}>
            {t("Saat aplikasi dibuka pada atau setelah tanggal itu, transaksi dibuat otomatis. Tanggal yang terlewat dicatat sekaligus.")}
          </p>

          <label className="sk-check">
            <input
              type="checkbox"
              checked={isSubscription}
              onChange={(e) => setIsSubscription(e.target.checked)}
            />
            <span>
              <b>{t("Langganan")}</b>
              <small>{t("Tandai sebagai langganan berbayar untuk ringkasan biaya bulanan.")}</small>
            </span>
          </label>
          <label className="sk-check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <b>{t("Aktif")}</b>
              <small>{t("Jadwal nonaktif tidak membuat transaksi baru.")}</small>
            </span>
          </label>
          {item ? (
            <div className="sk-rec-sheet-actions">
              <Button
                label={t("Lewati sekali")}
                variant="ghost"
                size="sm"
                onClick={() => {
                  skipRecurring(item.id);
                  setNextDate(advanceDate(nextDate, interval));
                  notify('Jadwal dilewati satu kali', 'info');
                }}
              />
              <Button
                label={t("Catat sekarang")}
                variant="secondary"
                size="sm"
                onClick={() => {
                  postRecurring(item.id);
                  notify(`${item.name} dicatat`);
                  onOpenChange(false);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="sk-sheet-actions">
        {item ? (
          <Button label={t("Hapus")} variant="destructive" onClick={destroy} />
        ) : (
          <Button label={t("Batal")} variant="ghost" onClick={() => onOpenChange(false)} />
        )}
        <Button label={item ? 'Simpan perubahan' : t("Simpan")} variant="primary" onClick={save} />
      </div>
    </Dialog>
  );
}
