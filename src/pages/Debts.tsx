import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { useStore } from '../lib/store';
import type { Debt, DebtKind } from '../lib/types';
import { money, shortDate, daysBetween, todayISO, clamp } from '../lib/format';
import { EmptyState } from '../components/EmptyState';

export default function Debts({
  onAdd,
  onEdit,
  onPay,
}: {
  onAdd: (kind: DebtKind) => void;
  onEdit: (debt: Debt) => void;
  onPay: (debt: Debt) => void;
}) {
  const { state, debtPaid, accountById } = useStore();
  const [tab, setTab] = useState<DebtKind>('debt');

  const list = useMemo(() => state.debts.filter((d) => d.kind === tab), [state.debts, tab]);

  const totals = useMemo(() => {
    return list.reduce(
      (acc, d) => {
        const paid = debtPaid(d.id);
        acc.total += d.total;
        acc.paid += Math.min(paid, d.total);
        return acc;
      },
      { total: 0, paid: 0 },
    );
  }, [list, debtPaid]);

  const today = todayISO();

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">{tab === 'debt' ? 'Kewajiban' : 'Piutang'}</p>
          <h1 className="sk-title">{tab === 'debt' ? 'Utang' : 'Piutang'}</h1>
          <p className="sk-sub">
            {tab === 'debt' ? 'Sisa yang harus kamu bayar' : 'Sisa yang harus kamu tagih'} ·{' '}
            {money(totals.total - totals.paid)} dari {money(totals.total)}
          </p>
        </div>
        <Button
          label={tab === 'debt' ? 'Catat utang' : 'Catat piutang'}
          variant="primary"
          onClick={() => onAdd(tab)}
        />
      </div>

      <div className="sk-type-row" style={{ maxWidth: 320 }} role="radiogroup" aria-label="Jenis catatan">
        <button
          type="button"
          role="radio"
          aria-checked={tab === 'debt'}
          className="sk-type-btn"
          data-tone="expense"
          data-active={tab === 'debt'}
          onClick={() => setTab('debt')}
        >
          Utang
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tab === 'loan'}
          className="sk-type-btn"
          data-tone="income"
          data-active={tab === 'loan'}
          onClick={() => setTab('loan')}
        >
          Piutang
        </button>
      </div>

      {list.length === 0 ? (
        <div className="sk-card">
          <EmptyState
            icon="receipt"
            title={tab === 'debt' ? 'Belum ada utang' : 'Belum ada piutang'}
            hint={tab === 'debt' ? 'Catat pinjaman supaya cicilannya terpantau.' : 'Catat uang yang kamu pinjamkan ke orang lain.'}
            action={
              <Button
                label={tab === 'debt' ? 'Catat utang' : 'Catat piutang'}
                variant="secondary"
                onClick={() => onAdd(tab)}
              />
            }
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {list.map((debt) => {
            const paid = debtPaid(debt.id);
            const remaining = Math.max(debt.total - paid, 0);
            const pct = debt.total > 0 ? clamp(Math.round((paid / debt.total) * 100), 0, 100) : 0;
            const settled = remaining <= 0;
            const overdueDays = debt.dueDate ? daysBetween(debt.dueDate, today) : 0;
            const overdue = !settled && debt.dueDate && overdueDays > 0;

            return (
              <article key={debt.id} className="sk-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'start' }}>
                  <div>
                    <div className="sk-card-title">{debt.name}</div>
                    <div className="sk-sub" style={{ fontSize: '0.78rem' }}>
                      {accountById(debt.accountId)?.name} · mulai {shortDate(debt.startDate)}
                    </div>
                  </div>
                  <span
                    className="sk-badge"
                    data-tone={settled ? 'success' : overdue ? 'error' : 'neutral'}
                  >
                    {settled ? 'Lunas' : overdue ? `Lewat ${overdueDays} hari` : debt.dueDate ? `Jatuh tempo ${shortDate(debt.dueDate)}` : 'Berjalan'}
                  </span>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Sisa</span>
                    <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(remaining)}</b>
                  </div>
                  <div className="sk-progress" data-tone={settled ? undefined : overdue ? 'error' : undefined}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 5 }}>
                    <span>{pct}% terbayar</span>
                    <span>
                      {money(paid)} / {money(debt.total)}
                    </span>
                  </div>
                </div>

                {debt.note ? (
                  <p className="sk-sub" style={{ fontSize: '0.78rem', margin: 0 }}>
                    {debt.note}
                  </p>
                ) : null}

                <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto' }}>
                  <Button
                    label={debt.kind === 'debt' ? 'Bayar' : 'Terima'}
                    variant="primary"
                    size="sm"
                    isDisabled={settled}
                    onClick={() => onPay(debt)}
                  />
                  <Button label="Ubah" variant="ghost" size="sm" onClick={() => onEdit(debt)} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
