import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { useStore } from '../lib/store';
import type { Recurring } from '../lib/types';
import { money, compactMoney, shortDate } from '../lib/format';
import { INTERVAL_LABEL, daysUntilNext, isDue, monthlyEquivalent } from '../lib/recurring';
import { EmptyState } from '../components/EmptyState';
import { iconFor } from '../lib/icons';

type Filter = 'all' | 'subscription' | 'bill';

function dueLabel(item: Recurring): { text: string; tone: string } {
  const days = daysUntilNext(item);
  if (!item.active) return { text: 'Nonaktif', tone: 'muted' };
  if (days < 0) return { text: `Terlambat ${Math.abs(days)} hari`, tone: 'error' };
  if (days === 0) return { text: 'Jatuh tempo hari ini', tone: 'warning' };
  if (days === 1) return { text: 'Jatuh tempo besok', tone: 'warning' };
  if (days <= 7) return { text: `Dalam ${days} hari`, tone: 'warning' };
  return { text: shortDate(item.nextDate), tone: 'muted' };
}

export function RecurringRow({
  item,
  onEdit,
}: {
  item: Recurring;
  onEdit: (item: Recurring) => void;
}) {
  const { state, categoryById, postRecurring, notify } = useStore();
  const category = categoryById(item.categoryId);
  const account = state.accounts.find((a) => a.id === item.accountId);
  const Icon = iconFor(item.isSubscription ? 'repeat' : category?.icon);
  const when = dueLabel(item);
  const due = isDue(item);

  return (
    <div className="sk-rec-row" data-due={due}>
      <button
        type="button"
        className="sk-rec-main"
        onClick={() => onEdit(item)}
        aria-label={`Ubah ${item.name}, ${INTERVAL_LABEL[item.interval]}, ${money(item.amount)}`}
      >
        <span className="sk-row-icon" data-tone={item.type}>
          <Icon />
        </span>
        <span className="sk-row-main">
          <span className="sk-row-title">
            {item.name}
            {item.isSubscription ? <span className="sk-badge">Langganan</span> : null}
            {!item.active ? <span className="sk-badge">Nonaktif</span> : null}
          </span>
          <span className="sk-row-meta">
            {[category?.name, account?.name, INTERVAL_LABEL[item.interval]].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      <span className="sk-rec-side">
        <span className={`sk-row-amount sk-amount-${item.type}`}>
          {item.type === 'income' ? '+' : '−'}
          {money(item.amount)}
        </span>
        <span className="sk-rec-when" data-tone={when.tone}>
          {when.text}
        </span>
      </span>
      <button
        type="button"
        className="sk-rec-post"
        onClick={() => {
          postRecurring(item.id);
          notify(`${item.name} dicatat`);
        }}
        aria-label={`Catat ${item.name} sekarang`}
      >
        Catat
      </button>
    </div>
  );
}

export default function RecurringPage({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (item: Recurring) => void;
}) {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => {
    return [...state.recurring]
      .filter((r) => (filter === 'all' ? true : filter === 'subscription' ? r.isSubscription : !r.isSubscription))
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0;
      });
  }, [state.recurring, filter]);

  const active = state.recurring.filter((r) => r.active);
  const due = active.filter((r) => isDue(r));
  const subscriptions = active.filter((r) => r.isSubscription);
  const monthlyOut = active
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + monthlyEquivalent(r), 0);

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">Otomatis</p>
          <h1 className="sk-title">Rutin &amp; langganan</h1>
          <p className="sk-sub">
            {active.length} jadwal aktif · {due.length} menunggu dicatat
          </p>
        </div>
        <Button label="Tambah jadwal" variant="primary" onClick={onAdd} />
      </div>

      <div className="sk-kpis">
        <div className="sk-kpi">
          <span>Keluar per bulan</span>
          <strong>{compactMoney(monthlyOut)}</strong>
        </div>
        <div className="sk-kpi">
          <span>Jadwal aktif</span>
          <strong>{active.length}</strong>
        </div>
        <div className="sk-kpi">
          <span>Langganan</span>
          <strong>{subscriptions.length}</strong>
        </div>
        <div className="sk-kpi" data-tone={due.length ? 'warning' : undefined}>
          <span>Jatuh tempo</span>
          <strong>{due.length}</strong>
        </div>
      </div>

      {due.length > 0 ? (
        <section className="sk-card" aria-labelledby="rec-due">
          <div className="sk-card-head">
            <h2 className="sk-card-title" id="rec-due">
              Menunggu dicatat
            </h2>
            <span className="sk-badge" data-tone="error">
              {due.length}
            </span>
          </div>
          <p className="sk-sub" style={{ marginTop: 0 }}>
            Transaksi ini otomatis masuk ke buku saat aplikasi dibuka. Kamu juga bisa mencatatnya sekarang.
          </p>
          <div className="sk-rows">
            {due.map((item) => (
              <RecurringRow key={item.id} item={item} onEdit={onEdit} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="sk-card" aria-labelledby="rec-all">
        <div className="sk-card-head">
          <h2 className="sk-card-title" id="rec-all">
            Semua jadwal
          </h2>
        </div>
        <div className="sk-chips" style={{ marginBottom: '0.5rem' }} role="group" aria-label="Saring jadwal">
          {([
            ['all', 'Semua'],
            ['subscription', 'Langganan'],
            ['bill', 'Tagihan rutin'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="sk-chip"
              data-active={filter === value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon="repeat"
            title={state.recurring.length === 0 ? 'Belum ada jadwal' : 'Tidak ada yang cocok'}
            hint={
              state.recurring.length === 0
                ? 'Tambahkan gaji, sewa, atau langganan agar tercatat otomatis.'
                : 'Coba pilih saringan lain.'
            }
            action={<Button label="Tambah jadwal" variant="secondary" onClick={onAdd} />}
          />
        ) : (
          <div className="sk-rows">
            {items.map((item) => (
              <RecurringRow key={item.id} item={item} onEdit={onEdit} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
