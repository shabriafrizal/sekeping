import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { useStore } from '../lib/store';
import type { Recurring } from '../lib/types';
import { money, compactMoney, shortDate } from '../lib/format';
import { INTERVAL_LABEL, daysUntilNext, isDue, monthlyEquivalent } from '../lib/recurring';
import { EmptyState } from '../components/EmptyState';
import { iconFor } from '../lib/icons';
import { t } from '../lib/i18n';

type Filter = 'all' | 'subscription' | 'bill';

function dueLabel(item: Recurring): { text: string; tone: string } {
  const days = daysUntilNext(item);
  if (!item.active) return { text: t("Nonaktif"), tone: 'muted' };
  if (days < 0) return { text: t('Terlambat {n} hari', { n: Math.abs(days) }), tone: 'error' };
  if (days === 0) return { text: t("Jatuh tempo hari ini"), tone: 'warning' };
  if (days === 1) return { text: t("Jatuh tempo besok"), tone: 'warning' };
  if (days <= 7) return { text: t('Dalam {n} hari', { n: days }), tone: 'warning' };
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
        aria-label={`Ubah ${item.name}, ${t(INTERVAL_LABEL[item.interval])}, ${money(item.amount)}`}
      >
        <span className="sk-row-icon" data-tone={item.type}>
          <Icon />
        </span>
        <span className="sk-row-main">
          <span className="sk-row-title">
            {item.name}
            {item.isSubscription ? <span className="sk-badge">{t("Langganan")}</span> : null}
            {!item.active ? <span className="sk-badge">{t("Nonaktif")}</span> : null}
          </span>
          <span className="sk-row-meta">
            {[category?.name, account?.name, t(INTERVAL_LABEL[item.interval])].filter(Boolean).join(' · ')}
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
      >{t("Catat")}</button>
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
          <p className="sk-eyebrow">{t("Otomatis")}</p>
          <h1 className="sk-title">{t("Rutin & langganan")}</h1>
          <p className="sk-sub">
            {t('{n} jadwal aktif · {m} menunggu dicatat', { n: active.length, m: due.length })}
          </p>
        </div>
        <Button label={t("Tambah jadwal")} variant="primary" onClick={onAdd} />
      </div>

      <div className="sk-kpis">
        <div className="sk-kpi">
          <span>{t("Keluar per bulan")}</span>
          <strong>{compactMoney(monthlyOut)}</strong>
        </div>
        <div className="sk-kpi">
          <span>{t("Jadwal aktif")}</span>
          <strong>{active.length}</strong>
        </div>
        <div className="sk-kpi">
          <span>{t("Langganan")}</span>
          <strong>{subscriptions.length}</strong>
        </div>
        <div className="sk-kpi" data-tone={due.length ? 'warning' : undefined}>
          <span>{t("Jatuh tempo")}</span>
          <strong>{due.length}</strong>
        </div>
      </div>

      {due.length > 0 ? (
        <section className="sk-card" aria-labelledby="rec-due">
          <div className="sk-card-head">
            <h2 className="sk-card-title" id="rec-due">{t("Menunggu dicatat")}</h2>
            <span className="sk-badge" data-tone="error">
              {due.length}
            </span>
          </div>
          <p className="sk-sub" style={{ marginTop: 0 }}>{t("Transaksi ini otomatis masuk ke buku saat aplikasi dibuka. Kamu juga bisa mencatatnya sekarang.")}</p>
          <div className="sk-rows">
            {due.map((item) => (
              <RecurringRow key={item.id} item={item} onEdit={onEdit} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="sk-card" aria-labelledby="rec-all">
        <div className="sk-card-head">
          <h2 className="sk-card-title" id="rec-all">{t("Semua jadwal")}</h2>
        </div>
        <div className="sk-chips" style={{ marginBottom: '0.5rem' }} role="group" aria-label={t("Saring jadwal")}>
          {([
            ['all', t("Semua")],
            ['subscription', t("Langganan")],
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
            title={t(state.recurring.length === 0 ? 'Belum ada jadwal' : 'Tidak ada yang cocok')}
            hint={
              state.recurring.length === 0
                ? t('Tambahkan gaji, sewa, atau langganan agar tercatat otomatis.')
                : 'Coba pilih saringan lain.'
            }
            action={<Button label={t("Tambah jadwal")} variant="secondary" onClick={onAdd} />}
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
