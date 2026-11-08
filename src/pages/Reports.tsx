import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../lib/store';
import { money, compactMoney, monthRange, toISO, monthLabel } from '../lib/format';
import { iconFor } from '../lib/icons';

type Period = 'month' | '3m' | 'year' | 'all';
type Mode = 'expense' | 'income';

const CHART_COLORS = [
  '#2f6b57',
  '#c98a4b',
  '#b8452f',
  '#5b7c99',
  '#8a6d9b',
  '#4e8c7a',
  '#c2a24a',
  '#8c7361',
];

const PERIOD_LABEL: Record<Period, string> = {
  month: 'Bulan ini',
  '3m': '3 bulan',
  year: 'Tahun ini',
  all: 'Semua',
};

function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date();
  if (period === 'month') return monthRange(toISO(now));
  if (period === '3m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: toISO(d), to: toISO(now) };
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: toISO(now) };
  return {};
}

export default function Reports() {
  const { state, categoryById } = useStore();
  const [mode, setMode] = useState<Mode>('expense');
  const [period, setPeriod] = useState<Period>('month');

  const { from, to } = periodRange(period);

  const filtered = useMemo(
    () =>
      state.txs.filter((tx) => {
        if (tx.type !== mode) return false;
        if (from && tx.date < from) return false;
        if (to && tx.date > to) return false;
        return true;
      }),
    [state.txs, mode, from, to],
  );

  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filtered) {
      const key = tx.categoryId ?? 'none';
      map.set(key, (map.get(key) ?? 0) + tx.amount);
    }
    return [...map.entries()]
      .map(([id, value]) => ({
        id,
        value,
        name: id === 'none' ? 'Tanpa kategori' : categoryById(id)?.name ?? 'Lainnya',
        icon: id === 'none' ? 'wallet' : categoryById(id)?.icon,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categoryById]);

  const trend = useMemo(() => {
    const months: Array<{ key: string; label: string; total: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = toISO(d).slice(0, 7);
      const totalMonth = state.txs
        .filter((t) => t.type === mode && t.date.slice(0, 7) === key)
        .reduce((s, t) => s + t.amount, 0);
      months.push({
        key,
        label: d.toLocaleDateString('id-ID', { month: 'short' }),
        total: totalMonth,
      });
    }
    return months;
  }, [state.txs, mode]);

  const average = trend.filter((t) => t.total > 0);
  const avgValue = average.length ? average.reduce((s, t) => s + t.total, 0) / average.length : 0;
  const top = byCategory[0];

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">Analisis</p>
          <h1 className="sk-title">Laporan</h1>
          <p className="sk-sub">{period === 'month' ? monthLabel(toISO(new Date())) : PERIOD_LABEL[period]} · transfer antar rekening tidak dihitung</p>
        </div>
      </div>

      <div className="sk-toolbar">
        <div className="sk-type-row" style={{ maxWidth: 280 }} role="radiogroup" aria-label="Jenis laporan">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'expense'}
            className="sk-type-btn"
            data-tone="expense"
            data-active={mode === 'expense'}
            onClick={() => setMode('expense')}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'income'}
            className="sk-type-btn"
            data-tone="income"
            data-active={mode === 'income'}
            onClick={() => setMode('income')}
          >
            Pendapatan
          </button>
        </div>
        <div className="sk-chips">
          {(['month', '3m', 'year', 'all'] as Period[]).map((p) => (
            <button key={p} type="button" className="sk-chip" data-active={period === p} onClick={() => setPeriod(p)}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <section className="sk-kpis">
        <div className="sk-kpi">
          <span>Total {mode === 'expense' ? 'pengeluaran' : 'pendapatan'}</span>
          <strong style={{ color: mode === 'expense' ? 'var(--color-error)' : 'var(--color-success)' }}>
            {money(total)}
          </strong>
        </div>
        <div className="sk-kpi">
          <span>Transaksi</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="sk-kpi">
          <span>Rata-rata / bulan</span>
          <strong>{compactMoney(avgValue)}</strong>
        </div>
        <div className="sk-kpi">
          <span>Terbesar</span>
          <strong>{top ? top.name : '—'}</strong>
        </div>
      </section>

      <section className="sk-report-grid">
        <div className="sk-card">
          <div className="sk-card-head">
            <h2 className="sk-card-title">Komposisi kategori</h2>
          </div>
          {byCategory.length === 0 ? (
            <p className="sk-sub" style={{ padding: '2rem 0', textAlign: 'center' }}>
              Belum ada data pada periode ini.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0,1fr)' }}>
              <div style={{ height: 220, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="92%"
                      paddingAngle={2}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {byCategory.map((entry, i) => (
                        <Cell key={entry.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => money(Number(value))}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-background-popover)',
                        color: 'var(--color-text-primary)',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    pointerEvents: 'none',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div className="sk-eyebrow" style={{ fontSize: '0.62rem' }}>
                      Total
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {compactMoney(total)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {byCategory.slice(0, 8).map((row, i) => {
                  const Icon = iconFor(row.icon);
                  const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
                  return (
                    <div key={row.id}>
                      <div className="sk-legend-row" style={{ marginBottom: 4 }}>
                        <span className="sk-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="sk-legend-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon style={{ width: 14, height: 14, opacity: 0.7 }} />
                          {row.name}
                        </span>
                        <b>{money(row.value)}</b>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', width: 34, textAlign: 'end' }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="sk-progress">
                        <i style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="sk-card">
          <div className="sk-card-head">
            <h2 className="sk-card-title">Tren 6 bulan</h2>
            <span className="sk-day-total">{mode === 'expense' ? 'Pengeluaran' : 'Pendapatan'}</span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8c8175' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#8c8175' }}
                  tickFormatter={(v: number) => compactMoney(v).replace('Rp ', '')}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(47,107,87,0.07)' }}
                  formatter={(value) => money(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-background-popover)',
                    color: 'var(--color-text-primary)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {trend.map((t, i) => (
                    <Cell
                      key={t.key}
                      fill={mode === 'expense' ? 'var(--color-accent)' : 'var(--color-success)'}
                      opacity={i === trend.length - 1 ? 1 : 0.45}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="sk-sub" style={{ fontSize: '0.74rem', marginTop: '0.6rem' }}>
            Rata-rata {compactMoney(avgValue)} per bulan dalam 6 bulan terakhir.
          </p>
        </div>
      </section>
    </div>
  );
}
