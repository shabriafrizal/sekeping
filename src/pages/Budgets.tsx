import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { useStore } from '../lib/store';
import type { Budget } from '../lib/types';
import { money, compactMoney, monthLabel } from '../lib/format';
import { budgetProgress, currentMonthKey, shiftMonth, toneFor } from '../lib/budgets';
import { EmptyState } from '../components/EmptyState';
import { iconFor } from '../lib/icons';

export default function Budgets({
  onAdd,
  onEdit,
}: {
  onAdd: (categoryId?: string) => void;
  onEdit: (budget: Budget) => void;
}) {
  const { state } = useStore();
  const [month, setMonth] = useState(currentMonthKey());

  const progress = useMemo(
    () =>
      state.budgets
        .map((b) =>
          budgetProgress(
            b,
            state.txs,
            month,
            state.categories.find((c) => c.id === b.categoryId),
          ),
        )
        .sort((a, b) => Number(b.budget.active) - Number(a.budget.active) || b.spent - a.spent),
    [state.budgets, state.txs, state.categories, month],
  );

  const activeProgress = progress.filter((p) => p.budget.active);
  const totalAvailable = activeProgress.reduce((sum, p) => sum + p.available, 0);
  const totalSpent = activeProgress.reduce((sum, p) => sum + p.spent, 0);
  const totalRemaining = totalAvailable - totalSpent;
  const overCount = activeProgress.filter((p) => p.remaining < 0).length;
  const rolloverIn = activeProgress.reduce((sum, p) => sum + p.carryIn, 0);

  const budgetedCategories = new Set(state.budgets.map((b) => b.categoryId));
  const unbudgeted = state.categories.filter(
    (c) => c.type === 'expense' && c.active && !budgetedCategories.has(c.id),
  );

  const isCurrent = month === currentMonthKey();

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">Rencana</p>
          <h1 className="sk-title">Anggaran</h1>
          <p className="sk-sub">
            {activeProgress.length} kategori · {overCount > 0 ? `${overCount} melewati batas` : 'semua dalam batas'}
          </p>
        </div>
        <div className="sk-month-nav" role="group" aria-label="Pilih bulan anggaran">
          <button type="button" className="sk-month-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Bulan sebelumnya">
            ‹
          </button>
          <span aria-live="polite">{monthLabel(`${month}-01`)}</span>
          <button type="button" className="sk-month-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Bulan berikutnya">
            ›
          </button>
          {!isCurrent ? (
            <button type="button" className="sk-link" onClick={() => setMonth(currentMonthKey())}>
              Bulan ini
            </button>
          ) : null}
        </div>
      </div>

      <div className="sk-kpis">
        <div className="sk-kpi">
          <span>Dana tersedia</span>
          <strong>{compactMoney(totalAvailable)}</strong>
        </div>
        <div className="sk-kpi">
          <span>Terpakai</span>
          <strong>{compactMoney(totalSpent)}</strong>
        </div>
        <div className="sk-kpi" data-tone={totalRemaining < 0 ? 'error' : undefined}>
          <span>{totalRemaining < 0 ? 'Kelebihan' : 'Tersisa'}</span>
          <strong>{compactMoney(Math.abs(totalRemaining))}</strong>
        </div>
        <div className="sk-kpi">
          <span>Rollover terkumpul</span>
          <strong>{compactMoney(rolloverIn)}</strong>
        </div>
      </div>

      <section className="sk-card" aria-labelledby="budget-list">
        <div className="sk-card-head">
          <h2 className="sk-card-title" id="budget-list">
            Anggaran per kategori
          </h2>
          <Button label="+ Tambah" variant="secondary" size="sm" onClick={() => onAdd()} />
        </div>

        {progress.length === 0 ? (
          <EmptyState
            icon="budget"
            title="Belum ada anggaran"
            hint="Tetapkan batas bulanan untuk kategori yang paling sering kamu pakai."
            action={<Button label="Buat anggaran" variant="secondary" onClick={() => onAdd()} />}
          />
        ) : (
          <div className="sk-budget-list">
            {progress.map((p) => {
              const tone = toneFor(p);
              const Icon = iconFor(p.category?.icon ?? 'budget');
              const percent = p.available > 0 ? Math.round((p.spent / p.available) * 100) : 100;
              return (
                <button
                  key={p.budget.id}
                  type="button"
                  className="sk-budget-row"
                  onClick={() => onEdit(p.budget)}
                  aria-label={`${p.category?.name ?? 'Kategori'}: terpakai ${money(p.spent)} dari ${money(p.available)}`}
                >
                  <span className="sk-row-icon" data-tone="expense">
                    <Icon />
                  </span>
                  <span className="sk-budget-main">
                    <span className="sk-budget-head">
                      <span className="sk-row-title">{p.category?.name ?? 'Kategori dihapus'}</span>
                      <span className="sk-badge" data-tone={tone === 'over' ? 'error' : tone === 'warning' ? 'success' : undefined}>
                        {percent}%
                      </span>
                      {p.budget.rollover ? <span className="sk-badge">Rollover</span> : null}
                      {!p.budget.active ? <span className="sk-badge">Nonaktif</span> : null}
                      {p.budget.startMonth > month ? <span className="sk-badge">Belum mulai</span> : null}
                    </span>
                    <span className="sk-progress" data-tone={tone === 'over' ? 'error' : tone === 'warning' ? 'warning' : undefined}>
                      <i style={{ width: `${Math.min(p.ratio * 100, 100)}%` }} />
                    </span>
                    <span className="sk-budget-meta">
                      <span>
                        {money(p.spent)} dari {money(p.available)}
                        {p.carryIn > 0 ? ` · termasuk sisa ${money(p.carryIn)}` : ''}
                      </span>
                      <b data-tone={tone === 'over' ? 'error' : undefined}>
                        {p.remaining < 0 ? `Lewat ${money(-p.remaining)}` : `Sisa ${money(p.remaining)}`}
                      </b>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {unbudgeted.length > 0 ? (
        <section className="sk-card">
          <div className="sk-card-head">
            <h2 className="sk-card-title">Kategori tanpa anggaran</h2>
          </div>
          <p className="sk-sub" style={{ marginTop: 0 }}>
            Pilih kategori untuk menetapkan batas bulanannya.
          </p>
          <div className="sk-chips">
            {unbudgeted.map((c) => {
              const Icon = iconFor(c.icon);
              return (
                <button key={c.id} type="button" className="sk-chip" onClick={() => onAdd(c.id)}>
                  <Icon aria-hidden="true" />
                  {c.name} <span aria-hidden="true">+</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <p className="sk-sub" style={{ fontSize: '0.74rem' }}>
        Rollover hanya meneruskan sisa positif ke bulan berikutnya; kelebihan tidak mengurangi jatah bulan depan.
      </p>
    </div>
  );
}
