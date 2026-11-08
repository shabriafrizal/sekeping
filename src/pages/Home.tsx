import { useMemo } from 'react';
import { currentMonth, useStore } from '../lib/store';
import { money, compactMoney, monthLabel, shortDate, dayLabel, toISO } from '../lib/format';
import { TxRow } from '../components/TxRow';
import { EmptyState } from '../components/EmptyState';
import { iconFor } from '../lib/icons';
import type { Tx } from '../lib/types';

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
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
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
  const { state, netWorth, balanceOf, monthTotals, categoryById } = useStore();
  const { from, to, iso } = currentMonth();

  const totals = monthTotals(from, to);
  const monthTx = state.txs.filter((t) => t.date >= from && t.date <= to);
  const recent = [...state.txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)).slice(0, 6);

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of monthTx) {
      if (tx.type !== 'expense' || !tx.categoryId) continue;
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, value]) => ({ id, value, name: categoryById(id)?.name ?? 'Lainnya', icon: categoryById(id)?.icon }));
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
      days.push({ date: key, label: d.toLocaleDateString('id-ID', { weekday: 'short' }), total });
    }
    return days;
  }, [state.txs]);

  const max7 = Math.max(...last7.map((d) => d.total), 1);
  const savingRate = totals.income > 0 ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">
            {greeting()}, {state.settings.userName || 'Kamu'}
          </p>
          <h1 className="sk-title">Ringkasan</h1>
          <p className="sk-sub">{monthLabel(iso)} · semua rekening</p>
        </div>
        <div className="sk-chips">
          <button className="sk-chip" type="button" onClick={() => onAdd('income')}>
            + Pendapatan
          </button>
          <button className="sk-chip" data-active="true" type="button" onClick={() => onAdd('expense')}>
            + Pengeluaran
          </button>
        </div>
      </div>

      <section className="sk-hero">
        <p className="sk-hero-label">Total saldo</p>
        <p className="sk-hero-balance">{money(netWorth)}</p>
        <div className="sk-hero-grid">
          <div className="sk-hero-stat">
            <span>Masuk bulan ini</span>
            <strong>+{money(totals.income)}</strong>
          </div>
          <div className="sk-hero-stat">
            <span>Keluar bulan ini</span>
            <strong>−{money(totals.expense)}</strong>
          </div>
        </div>
        <div className="sk-hero-actions">
          <button className="sk-hero-chip" type="button" onClick={() => onAdd('expense')}>
            <PlusIcon /> Transaksi
          </button>
          <button className="sk-hero-chip" type="button" onClick={() => onAdd('transfer')}>
            <TransferIcon /> Transfer
          </button>
          <button className="sk-hero-chip" type="button" onClick={() => onNavigate('reports')}>
            <ChartIcon /> Laporan
          </button>
        </div>
      </section>

      <section>
        <div className="sk-card-head">
          <h2 className="sk-card-title">Rekening</h2>
          <button className="sk-link" type="button" onClick={() => onNavigate('settings')}>
            Kelola
          </button>
        </div>
        <div className="sk-strip">
          {state.accounts.map((acc) => {
            const Icon = iconFor(acc.icon);
            return (
              <button
                key={acc.id}
                type="button"
                className="sk-account"
                onClick={() => onNavigate('settings')}
                aria-label={`${acc.name}, saldo ${money(balanceOf(acc.id))}`}
              >
                <span className="sk-account-top">
                  <span className="sk-account-icon">
                    <Icon />
                  </span>
                  <span className="sk-account-name">{acc.name}</span>
                </span>
                <span className="sk-account-bal">{money(balanceOf(acc.id))}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sk-kpis">
        <div className="sk-kpi">
          <span>Rasio tabungan</span>
          <strong style={{ color: savingRate >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
            {savingRate}%
          </strong>
        </div>
        <div className="sk-kpi">
          <span>Transaksi bulan ini</span>
          <strong>{monthTx.length}</strong>
        </div>
        <div className="sk-kpi">
          <span>Rata-rata / hari</span>
          <strong>{compactMoney(totals.expense / Math.max(new Date().getDate(), 1))}</strong>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: '1rem' }} className="sk-home-grid">
        <div className="sk-card">
          <div className="sk-card-head">
            <h2 className="sk-card-title">Transaksi terakhir</h2>
            <button className="sk-link" type="button" onClick={() => onNavigate('transactions')}>
              Lihat semua
            </button>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title="Belum ada transaksi"
              hint="Mulai catat pengeluaran pertamamu."
              action={<button className="sk-chip" onClick={() => onAdd('expense')}>Tambah transaksi</button>}
            />
          ) : (
            <div className="sk-rows">
              {recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} onClick={() => onOpenTx(tx)} />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="sk-card">
            <div className="sk-card-head">
              <h2 className="sk-card-title">7 hari terakhir</h2>
              <span className="sk-day-total">{compactMoney(last7.reduce((s, d) => s + d.total, 0))}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.45rem', height: 92 }}>
              {last7.map((d) => (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {d.total > 0 ? compactMoney(d.total).replace('Rp ', '') : ''}
                  </span>
                  <div
                    title={`${dayLabel(d.date)}: ${money(d.total)}`}
                    style={{
                      width: '100%',
                      height: `${Math.max(4, (d.total / max7) * 56)}px`,
                      borderRadius: 6,
                      background: d.total === 0 ? 'var(--color-background-muted)' : 'var(--color-accent)',
                      opacity: d.total === 0 ? 1 : 0.35 + (d.total / max7) * 0.65,
                    }}
                  />
                  <span style={{ fontSize: '0.62rem', color: 'var(--color-text-secondary)' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sk-card">
            <div className="sk-card-head">
              <h2 className="sk-card-title">Paling boros</h2>
              <button className="sk-link" type="button" onClick={() => onNavigate('reports')}>
                Laporan
              </button>
            </div>
            {topCategories.length === 0 ? (
              <p className="sk-sub">Belum ada pengeluaran bulan ini.</p>
            ) : (
              <div className="sk-legend">
                {topCategories.map((c, i) => (
                  <div className="sk-legend-row" key={c.id}>
                    <span className="sk-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="sk-legend-name">{c.name}</span>
                    <b>{compactMoney(c.value)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <p className="sk-sub" style={{ textAlign: 'center', fontSize: '0.72rem' }}>
        Terakhir diperbarui {shortDate(iso)}
      </p>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function TransferIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 8h13l-3-3M20 16H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M5 19V9M12 19V5M19 19v-6" strokeLinecap="round" />
    </svg>
  );
}
