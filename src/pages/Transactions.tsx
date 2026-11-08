import { useMemo, useState } from 'react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { useStore } from '../lib/store';
import type { Tx, TxType } from '../lib/types';
import { money, dayLabel, monthRange, toISO, compareTxs } from '../lib/format';
import { TxRow } from '../components/TxRow';
import { EmptyState } from '../components/EmptyState';
import { t } from '../lib/i18n';

type Period = 'month' | '3m' | 'year' | 'all';

function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date();
  if (period === 'month') {
    return monthRange(toISO(now));
  }
  if (period === '3m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: toISO(d), to: toISO(now) };
  }
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: toISO(now) };
  }
  return {};
}

const PERIOD_LABEL: Record<Period, string> = {
  month: t("Bulan ini"),
  '3m': t("3 bulan"),
  year: t("Tahun ini"),
  all: t("Semua"),
};

export default function Transactions({
  onAdd,
  onOpenTx,
}: {
  onAdd: (type?: TxType) => void;
  onOpenTx: (tx: Tx) => void;
}) {
  const { state, accountById } = useStore();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | TxType>('all');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [period, setPeriod] = useState<Period>('month');

  const { from, to } = periodRange(period);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.txs
      .filter((tx) => {
        if (type !== 'all' && tx.type !== type) return false;
        if (accountId !== 'all' && tx.accountId !== accountId && tx.toAccountId !== accountId) return false;
        if (categoryId !== 'all' && tx.categoryId !== categoryId) return false;
        if (from && tx.date < from) return false;
        if (to && tx.date > to) return false;
        if (q) {
          const cat = state.categories.find((c) => c.id === tx.categoryId)?.name ?? '';
          const acc = state.accounts.find((a) => a.id === tx.accountId)?.name ?? '';
          if (!`${tx.note} ${cat} ${acc}`.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort(compareTxs);
  }, [state.txs, state.categories, state.accounts, type, accountId, categoryId, from, to, search]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    }
    return { income, expense };
  }, [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const tx of filtered) {
      const arr = map.get(tx.date) ?? [];
      arr.push(tx);
      map.set(tx.date, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const hasFilters = search !== '' || type !== 'all' || accountId !== 'all' || categoryId !== 'all' || period !== 'month';

  const accountOptions = [
    { value: 'all', label: t("Semua rekening") },
    ...state.accounts.map((a) => ({ value: a.id, label: a.name })),
  ];
  const categoryOptions = [
    { value: 'all', label: t("Semua kategori") },
    ...state.categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">{t("Riwayat")}</p>
          <h1 className="sk-title">{t("Transaksi")}</h1>
          <p className="sk-sub">
            {t('{n} catatan · masuk {in} · keluar {out}', { n: filtered.length, in: money(totals.income), out: money(totals.expense) })}
          </p>
        </div>
        <Button label={t("Tambah transaksi")} variant="primary" onClick={() => onAdd('expense')} />
      </div>

      <div className="sk-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <TextInput
          label={t("Cari transaksi")}
          isLabelHidden
          type="search"
          value={search}
          placeholder={t("Cari catatan, kategori, atau rekening…")}
          onChange={setSearch}
        />
        <div className="sk-chips">
          {([
            ['all', t("Semua")],
            ['expense', t("Pengeluaran")],
            ['income', t("Pendapatan")],
            ['transfer', t("Transfer")],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="sk-chip"
              data-active={type === value}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          {(['month', '3m', 'year', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className="sk-chip"
              data-active={period === p}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="sk-toolbar">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Selector
              label={t("Rekening")}
              isLabelHidden
              options={accountOptions}
              value={accountId}
              onChange={setAccountId}
              variant="secondary"
              size="sm"
            />
            <Selector
              label={t("Kategori")}
              isLabelHidden
              options={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
              variant="secondary"
              size="sm"
            />
          </div>
          {hasFilters ? (
            <button
              className="sk-link"
              type="button"
              onClick={() => {
                setSearch('');
                setType('all');
                setAccountId('all');
                setCategoryId('all');
                setPeriod('month');
              }}
            >{t("Reset filter")}</button>
          ) : null}
        </div>
      </div>

      <div className="sk-card">
        {groups.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={t("Tidak ada transaksi")}
            hint={t("Coba ubah filter atau catat transaksi baru.")}
            action={<Button label={t("Tambah transaksi")} variant="secondary" onClick={() => onAdd('expense')} />}
          />
        ) : (
          groups.map(([date, list]) => {
            const dayExpense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            const dayIncome = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            return (
              <div key={date}>
                <div className="sk-day-head">
                  <strong>{dayLabel(date)}</strong>
                  <span className="sk-day-total">
                    {dayIncome > 0 ? `+${money(dayIncome)}` : ''}
                    {dayIncome > 0 && dayExpense > 0 ? ' · ' : ''}
                    {dayExpense > 0 ? `−${money(dayExpense)}` : ''}
                  </span>
                </div>
                <div className="sk-rows">
                  {list.map((tx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      onClick={() => {
                        onOpenTx(tx);
                        void accountById;
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
