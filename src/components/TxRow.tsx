import type { Tx } from '../lib/types';
import { useStore } from '../lib/store';
import { money, txWhen } from '../lib/format';
import { iconFor } from '../lib/icons';

export function TxRow({ tx, onClick }: { tx: Tx; onClick: () => void }) {
  const { accountById, categoryById } = useStore();
  const cat = categoryById(tx.categoryId);
  const acc = accountById(tx.accountId);
  const dest = accountById(tx.toAccountId);

  const Icon = iconFor(
    tx.type === 'transfer' ? 'wallet' : cat?.icon ?? (tx.type === 'income' ? 'briefcase' : 'bag'),
  );

  const title =
    tx.type === 'transfer'
      ? `${acc?.name ?? 'Rekening'} → ${dest?.name ?? 'Rekening'}`
      : cat?.name ?? tx.note ?? 'Transaksi';
  const meta = [tx.note, txWhen(tx)].filter(Boolean).join(' · ');

  return (
    <button type="button" className="sk-row" onClick={onClick} aria-label={`${title}, ${money(tx.amount)}`}>
      <span className="sk-row-icon" data-tone={tx.type}>
        <Icon />
      </span>
      <span className="sk-row-main">
        <span className="sk-row-title">{title}</span>
        <span className="sk-row-meta">{meta}</span>
      </span>
      <span className={`sk-row-amount sk-amount-${tx.type}`}>
        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
        {money(tx.amount)}
      </span>
    </button>
  );
}
