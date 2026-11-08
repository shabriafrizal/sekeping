import { useMemo, useState } from 'react';
import { currentMonth, useStore } from '../lib/store';
import { money, compactMoney, compactNumber, formatDate, monthLabel, dayLabel, toISO, compareTxs } from '../lib/format';
import { TxRow } from '../components/TxRow';
import { EmptyState } from '../components/EmptyState';
import { iconFor } from '../lib/icons';
import type { Tx } from '../lib/types';
import { daysUntilNext } from '../lib/recurring';
import { t } from '../lib/i18n';

const BellIcon = iconFor('bell');
const CheckIcon = iconFor('check');

const CHART_COLORS = [
  'var(--sk-chart-1)',
  'var(--sk-chart-2)',
  'var(--sk-chart-3)',
  'var(--sk-chart-4)',
  'var(--sk-chart-5)',
  'var(--sk-chart-6)',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return t("Selamat pagi");
  if (h < 15) return t("Selamat siang");
  if (h < 19) return t("Selamat sore");
  return t("Selamat malam");
}

function longDate(d: Date) {
  return formatDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function reminderLabel(days: number) {
  if (days < 0) return t('Terlambat {n} hari', { n: Math.abs(days) });
  if (days === 0) return t("Jatuh tempo hari ini");
  if (days === 1) return t("Jatuh tempo besok");
  return t('Jatuh tempo dalam {n} hari', { n: days });
}

export default function Home({
  onAdd,
  onOpenTx,
  onNavigate,
}: {
  onAdd: (type?: 'expense' | 'income' | 'transfer') => void;
  onOpenTx: (tx: Tx) => void;
  onNavigate: (page: string) => void;
}) {
  const { state, netWorth, balanceOf, monthTotals, categoryById, completeRecurring, notify } = useStore();
  const [justDone, setJustDone] = useState<string[]>([]);
  const { from, to, iso } = currentMonth();
  const now = new Date();

  const totals = monthTotals(from, to);
  const flow = totals.income - totals.expense;
  const savingRate = totals.income > 0 ? Math.round((flow / totals.income) * 100) : null;
  const monthTx = state.txs.filter((t) => t.date >= from && t.date <= to);
  const recent = [...state.txs].sort(compareTxs).slice(0, 6);
  const dailyAverage = totals.expense / Math.max(now.getDate(), 1);

  const positiveTotal = state.accounts
    .filter((a) => a.active)
    .reduce((sum, a) => sum + Math.max(balanceOf(a.id), 0), 0);

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of monthTx) {
      if (tx.type !== 'expense' || !tx.categoryId) continue;
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, value]) => ({ id, value, name: categoryById(id)?.name ?? t("Lainnya") }));
  }, [monthTx, categoryById]);

  const last7 = useMemo(() => {
    const days: Array<{ date: string; label: string; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toISO(d);
      const total = state.txs
        .filter((t) => t.date === key && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
      days.push({ date: key, label: formatDate(d, { weekday: 'short' }), total });
    }
    return days;
  }, [state.txs]);

  const week = last7.reduce((s, d) => s + d.total, 0);
  const maxDay = Math.max(...last7.map((d) => d.total), 1);
  const maxCategory = Math.max(...topCategories.map((c) => c.value), 1);

  /* Bills and subscriptions due in the next seven days (overdue included). */
  const reminders = useMemo(
    () =>
      state.recurring
        .filter(
          (r) =>
            r.active &&
            r.type === 'expense' &&
            !justDone.includes(r.id) &&
            daysUntilNext(r) <= 7 &&
            (!r.endDate || r.nextDate <= r.endDate),
        )
        .sort((a, b) => (a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0)),
    [state.recurring, justDone],
  );

  return (
    <div className="sk-page sk-home">
      <header className="sk-page-head">
        <div>
          <h1 className="sk-title">{t("Ringkasan")}</h1>
          <p className="sk-sub">
            {greeting()}, {state.settings.userName || 'Kamu'}. {longDate(now)}
          </p>
        </div>
        <div className="sk-chips">
          <button className="sk-chip" type="button" onClick={() => onAdd('transfer')}>{t("Transfer")}</button>
          <button className="sk-chip" type="button" onClick={() => onAdd('income')}>{t("+ Pendapatan")}</button>
          <button className="sk-chip" data-active="true" type="button" onClick={() => onAdd('expense')}>{t("+ Pengeluaran")}</button>
        </div>
      </header>

      <div className="sk-home-top">
        <section className="sk-ledger" aria-labelledby="home-total" data-tour="balance">
          <p className="sk-ledger-label" id="home-total">{t("Total saldo")}</p>
          <p className="sk-ledger-total">{money(netWorth)}</p>
          <dl className="sk-ledger-lines">
            <div>
              <dt>{t("Masuk bulan ini")}</dt>
              <dd data-tone="income">+{money(totals.income)}</dd>
            </div>
            <div>
              <dt>{t("Keluar bulan ini")}</dt>
              <dd>−{money(totals.expense)}</dd>
            </div>
            <div data-total="true">
              <dt>{t("Sisa bulan ini")}</dt>
              <dd data-tone={flow < 0 ? 'expense' : 'income'}>
                {flow < 0 ? '−' : ''}
                {money(Math.abs(flow))}
              </dd>
            </div>
          </dl>
        </section>

        <section className="sk-home-block" data-tour="accounts">
          <div className="sk-home-head">
            <h2 className="sk-home-title">{t("Rekening")}</h2>
            <button className="sk-link" type="button" onClick={() => onNavigate('settings')}>{t("Kelola")}</button>
          </div>
          <ul className="sk-accounts">
            {state.accounts.map((acc) => {
              const Icon = iconFor(acc.icon);
              const balance = balanceOf(acc.id);
              const share = acc.active && positiveTotal > 0 ? Math.max(balance, 0) / positiveTotal : 0;
              return (
                <li key={acc.id}>
                  <button
                    type="button"
                    className="sk-account-row"
                    onClick={() => onNavigate('settings')}
                    aria-label={`${acc.name}, saldo ${money(balance)}`}
                  >
                    <span className="sk-account-icon">
                      <Icon />
                    </span>
                    <span className="sk-account-main">
                      <span className="sk-account-name">
                        {acc.name}
                        {acc.active ? null : <span className="sk-account-note"> · nonaktif</span>}
                      </span>
                      <span className="sk-share" aria-hidden="true">
                        <i style={{ width: `${share * 100}%` }} />
                      </span>
                    </span>
                    <span className="sk-account-bal">{money(balance)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {reminders.length > 0 ? (
        <section className="sk-reminders" aria-labelledby="home-reminders">
          <div className="sk-reminder-head">
            <div>
              <h2 className="sk-home-title" id="home-reminders">
                <BellIcon aria-hidden="true" />{t("Pengingat")}<span className="sk-badge" data-tone="neutral">
                  {reminders.length}
                </span>
              </h2>
              <p className="sk-sub" style={{ marginTop: '0.15rem' }}>{t("Tagihan & langganan jatuh tempo dalam 7 hari. Tandai selesai untuk mencatatnya hari ini.")}</p>
            </div>
            <button className="sk-link" type="button" onClick={() => onNavigate('recurring')}>{t("Kelola")}</button>
          </div>
          <ul className="sk-reminder-list">
            {reminders.map((item) => {
              const days = daysUntilNext(item);
              const category = categoryById(item.categoryId);
              const Icon = iconFor(item.isSubscription ? 'repeat' : category?.icon);
              return (
                <li
                  key={item.id}
                  className="sk-reminder-row"
                  data-tone={days < 0 ? 'error' : days <= 1 ? 'warning' : undefined}
                >
                  <span className="sk-row-icon" data-tone="expense">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="sk-reminder-main">
                    <span className="sk-reminder-title">
                      {item.name}
                      {item.isSubscription ? <span className="sk-badge">{t("Langganan")}</span> : null}
                    </span>
                    <span className="sk-reminder-meta">
                      {[category?.name, reminderLabel(days)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="sk-reminder-amount">−{money(item.amount)}</span>
                  <button
                    type="button"
                    className="sk-reminder-done"
                    onClick={() => {
                      completeRecurring(item.id);
                      setJustDone((prev) => [...prev, item.id]);
                      notify(`${item.name} selesai dicatat`);
                    }}
                    aria-label={`Tandai ${item.name} selesai dan catat pengeluaran hari ini`}
                  >
                    <CheckIcon aria-hidden="true" />{t("Selesai")}</button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="sk-home-bottom">
        <section className="sk-home-block">
          <div className="sk-home-head">
            <h2 className="sk-home-title">{t("Transaksi terakhir")}</h2>
            <button className="sk-link" type="button" onClick={() => onNavigate('transactions')}>{t("Lihat semua")}</button>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title={t("Belum ada transaksi")}
              hint={t("Mulai catat pengeluaran pertamamu.")}
              action={<button className="sk-chip" onClick={() => onAdd('expense')}>{t("Tambah transaksi")}</button>}
            />
          ) : (
            <div className="sk-rows">
              {recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} onClick={() => onOpenTx(tx)} />
              ))}
            </div>
          )}
          <p className="sk-sub">{t('{n} transaksi bulan ini.', { n: monthTx.length })}</p>
        </section>

        <section className="sk-home-block sk-home-month" data-tour="month">
          <div className="sk-home-head">
            <h2 className="sk-home-title">{t("Bulan ini")}</h2>
            <span className="sk-day-total">{monthLabel(iso)}</span>
          </div>

          <div className="sk-save">
            <span className="sk-save-label">{t("Tingkat tabungan")}</span>
            <strong className="sk-save-figure" data-tone={savingRate !== null && savingRate < 0 ? 'error' : undefined}>
              {savingRate === null ? '–' : `${savingRate}%`}
            </strong>
            <div className="sk-progress" data-tone={savingRate !== null && savingRate < 0 ? 'error' : undefined}>
              <i style={{ width: `${Math.min(Math.max(savingRate ?? 0, 0), 100)}%` }} />
            </div>
            <p className="sk-sub">
              {totals.income === 0
                ? t("Belum ada pemasukan bulan ini.")
                : flow >= 0
                  ? t('Dari {income} pemasukan, {flow} tersisa.', { income: money(totals.income), flow: money(flow) })
                  : t('Pengeluaran melebihi pemasukan sebesar {amount}.', { amount: money(-flow) })}
            </p>
          </div>

          <div className="sk-week">
            <div className="sk-subhead">
              <span>{t("7 hari terakhir")}</span>
              <span className="sk-day-total">{compactMoney(week)}</span>
            </div>
            <div
              className="sk-week-bars"
              role="img"
              aria-label={`Pengeluaran tujuh hari terakhir: ${last7
                .map((d) => `${d.label} ${money(d.total)}`)
                .join(', ')}`}
            >
              {last7.map((d) => (
                <div key={d.date} className="sk-week-day">
                  <span className="sk-week-value">{d.total > 0 ? compactNumber(d.total) : ''}</span>
                  <div
                    className="sk-week-bar"
                    data-empty={d.total === 0}
                    title={`${dayLabel(d.date)}: ${money(d.total)}`}
                    style={{ height: `${d.total === 0 ? 3 : Math.max(8, (d.total / maxDay) * 72)}px` }}
                  />
                  <span className="sk-week-label">{d.label}</span>
                </div>
              ))}
            </div>
            <p className="sk-sub">{t('Rata-rata {amount} per hari bulan ini.', { amount: compactMoney(dailyAverage) })}</p>
          </div>

          <div className="sk-rank">
            <div className="sk-subhead">
              <span>{t("Paling boros")}</span>
              <button className="sk-link" type="button" onClick={() => onNavigate('reports')}>{t("Laporan")}</button>
            </div>
            {topCategories.length === 0 ? (
              <p className="sk-sub">{t("Belum ada pengeluaran bulan ini.")}</p>
            ) : (
              topCategories.map((c, i) => (
                <div className="sk-rank-row" key={c.id}>
                  <div className="sk-rank-line">
                    <span className="sk-rank-name">{c.name}</span>
                    <b>{money(c.value)}</b>
                  </div>
                  <div className="sk-progress">
                    <i style={{ width: `${(c.value / maxCategory) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
