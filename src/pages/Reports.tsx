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
import {
  money,
  compactMoney,
  compactNumber,
  formatDate,
  monthRange,
  toISO,
  shortDate,
  daysBetween,
} from '../lib/format';
import { iconFor } from '../lib/icons';
import { t } from '../lib/i18n';

type Period =
  | 'today'
  | 'yesterday'
  | '7d'
  | 'month'
  | 'lastmonth'
  | '3m'
  | 'year'
  | '12m'
  | 'all'
  | 'custom';
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
  today: "Hari ini",
  yesterday: "Kemarin",
  '7d': "7 hari",
  month: "Bulan ini",
  lastmonth: "Bulan lalu",
  '3m': "3 bulan",
  year: "Tahun ini",
  '12m': "1 tahun",
  all: t("Semua"),
  custom: t("Rentang"),
};

const PERIODS: Period[] = [
  'today',
  'yesterday',
  '7d',
  'month',
  'lastmonth',
  '3m',
  'year',
  '12m',
  'all',
  'custom',
];

function periodRange(
  period: Period,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } {
  const now = new Date();
  const today = toISO(now);
  const daysAgo = (n: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
    return toISO(d);
  };
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: daysAgo(1), to: daysAgo(1) };
    case '7d':
      return { from: daysAgo(6), to: today };
    case 'month':
      return monthRange(today);
    case 'lastmonth': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return monthRange(toISO(d));
    }
    case '3m': {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from: toISO(d), to: today };
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: today };
    case '12m': {
      const d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { from: toISO(d), to: today };
    }
    case 'custom':
      return { from: customFrom || undefined, to: customTo || undefined };
    default:
      return {};
  }
}

export default function Reports() {
  const { state, categoryById } = useStore();
  const [mode, setMode] = useState<Mode>('expense');
  const [period, setPeriod] = useState<Period>('month');
  const nowISO = toISO(new Date());
  const [customFrom, setCustomFrom] = useState(`${nowISO.slice(0, 7)}-01`);
  const [customTo, setCustomTo] = useState(nowISO);

  const { from, to } = periodRange(period, customFrom, customTo);

  /* Keep the two ends in order: moving one past the other drags it along. */
  function changeFrom(value: string) {
    setCustomFrom(value);
    if (value && customTo && value > customTo) setCustomTo(value);
    setPeriod('custom');
  }

  function changeTo(value: string) {
    setCustomTo(value);
    if (value && customFrom && value < customFrom) setCustomFrom(value);
    setPeriod('custom');
  }

  function resetRange() {
    setCustomFrom(`${nowISO.slice(0, 7)}-01`);
    setCustomTo(nowISO);
    setPeriod('custom');
  }

  /* Presets also fill the date fields, so switching to Rentang continues from them. */
  function choosePeriod(next: Period) {
    setPeriod(next);
    if (next === 'custom' || next === 'all') return;
    const range = periodRange(next, customFrom, customTo);
    if (range.from) setCustomFrom(range.from);
    if (range.to) setCustomTo(range.to);
  }

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
        name: id === 'none' ? 'Tanpa kategori' : categoryById(id)?.name ?? t("Lainnya"),
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
        label: formatDate(d, { month: 'short' }),
        total: totalMonth,
      });
    }
    return months;
  }, [state.txs, mode]);

  const average = trend.filter((t) => t.total > 0);
  const avgValue = average.length ? average.reduce((s, t) => s + t.total, 0) / average.length : 0;
  const top = byCategory[0];
  const rangeDays = from && to ? Math.max(1, daysBetween(from, to) + 1) : null;
  const perDay = rangeDays ? total / rangeDays : 0;
  const usePerDay = rangeDays !== null && Boolean(from) && Boolean(to);
  const rangeSubtitle =
    period === 'all' || !from || !to
      ? t('Semua waktu')
      : `${shortDate(from)} – ${shortDate(to)}${rangeDays ? t(' · {n} hari', { n: rangeDays }) : ''}`;

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">{t("Analisis")}</p>
          <h1 className="sk-title">{t("Laporan")}</h1>
          <p className="sk-sub">{rangeSubtitle} · {t('transfer antar rekening tidak dihitung')}</p>
        </div>
      </div>

      <div className="sk-toolbar">
        <div className="sk-type-row" style={{ maxWidth: 280 }} role="radiogroup" aria-label={t("Jenis laporan")}>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'expense'}
            className="sk-type-btn"
            data-tone="expense"
            data-active={mode === 'expense'}
            onClick={() => setMode('expense')}
          >{t("Pengeluaran")}</button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'income'}
            className="sk-type-btn"
            data-tone="income"
            data-active={mode === 'income'}
            onClick={() => setMode('income')}
          >{t("Pendapatan")}</button>
        </div>
        <div className="sk-chips">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className="sk-chip"
              data-active={period === p}
              aria-pressed={period === p}
              onClick={() => choosePeriod(p)}
            >
              {t(PERIOD_LABEL[p])}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' ? (
        <div className="sk-range" role="group" aria-label={t("Rentang tanggal laporan")}>
          <label className="sk-field">
            <span className="sk-eyebrow">{t("Dari tanggal")}</span>
            <input
              className="sk-input"
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => changeFrom(e.target.value)}
            />
          </label>
          <span className="sk-range-dash" aria-hidden="true">
            –
          </span>
          <label className="sk-field">
            <span className="sk-eyebrow">{t("Sampai tanggal")}</span>
            <input
              className="sk-input"
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => changeTo(e.target.value)}
            />
          </label>
          <button type="button" className="sk-link sk-range-reset" onClick={resetRange}>{t("Bulan ini")}</button>
        </div>
      ) : null}

      <section className="sk-kpis">
        <div className="sk-kpi">
          <span>{t(mode === 'expense' ? 'Total pengeluaran' : 'Total pendapatan')}</span>
          <strong style={{ color: mode === 'expense' ? 'var(--color-error)' : 'var(--color-success)' }}>
            {money(total)}
          </strong>
        </div>
        <div className="sk-kpi">
          <span>{t("Transaksi")}</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="sk-kpi">
          <span>{usePerDay ? t('Rata-rata / hari') : t('Rata-rata / bulan')}</span>
          <strong>{compactMoney(usePerDay ? perDay : avgValue)}</strong>
        </div>
        <div className="sk-kpi">
          <span>{t("Terbesar")}</span>
          <strong>{top ? top.name : '—'}</strong>
        </div>
      </section>

      <section className="sk-report-grid">
        <div className="sk-card">
          <div className="sk-card-head">
            <h2 className="sk-card-title">{t("Komposisi kategori")}</h2>
          </div>
          {byCategory.length === 0 ? (
            <p className="sk-sub" style={{ padding: '2rem 0', textAlign: 'center' }}>{t("Belum ada data pada periode ini.")}</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0,1fr)' }}>
              <div
                style={{ height: 220, position: 'relative' }}
                role="img"
                aria-label={`Komposisi ${mode === 'expense' ? 'pengeluaran' : 'pendapatan'}: ${byCategory
                  .slice(0, 6)
                  .map((c) => `${c.name} ${money(c.value)}`)
                  .join(', ')}`}
              >
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
                    <div className="sk-eyebrow" style={{ fontSize: '0.62rem' }}>{t("Total")}</div>
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
            <h2 className="sk-card-title">{t("Tren 6 bulan")}</h2>
            <span className="sk-day-total">{t(mode === 'expense' ? 'Pengeluaran' : 'Pendapatan')}</span>
          </div>
          <div
            style={{ height: 220 }}
            role="img"
            aria-label={`Tren enam bulan, ${mode === 'expense' ? 'pengeluaran' : 'pendapatan'}: ${trend
              .map((t) => `${t.label} ${money(t.total)}`)
              .join(', ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8c8175' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#8c8175' }}
                  tickFormatter={(v: number) => compactNumber(v)}
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
            {t('Rata-rata {amount} per bulan dalam 6 bulan terakhir.', { amount: compactMoney(avgValue) })}
          </p>
        </div>
      </section>
    </div>
  );
}
