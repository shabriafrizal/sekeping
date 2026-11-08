import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { useStore } from '../lib/store';
import type { Tx } from '../lib/types';
import { money, shortDate } from '../lib/format';
import { iconFor } from '../lib/icons';

export default function TxDetail({
  tx,
  isOpen,
  onOpenChange,
  onEdit,
}: {
  tx: Tx | null;
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (tx: Tx) => void;
}) {
  const { accountById, categoryById, removeTx, notify } = useStore();
  if (!tx) return null;

  const cat = categoryById(tx.categoryId);
  const acc = accountById(tx.accountId);
  const dest = accountById(tx.toAccountId);
  const Icon = iconFor(tx.type === 'transfer' ? 'wallet' : cat?.icon ?? 'bag');
  const tone = tx.type === 'expense' ? 'expense' : tx.type === 'income' ? 'income' : 'transfer';

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={400}>
      <DialogHeader
        title={tx.type === 'transfer' ? 'Detail transfer' : 'Detail transaksi'}
        subtitle={shortDate(tx.date)}
        onOpenChange={onOpenChange}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: '1.2rem 0 0.5rem' }}>
        <span className="sk-row-icon" data-tone={tone} style={{ width: '3rem', height: '3rem', borderRadius: 16 }}>
          <Icon />
        </span>
        <div className="sk-detail-amount">
          {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
          {money(tx.amount)}
        </div>
        <p className="sk-sub" style={{ margin: 0 }}>
          {tx.type === 'transfer' ? 'Transfer antar rekening' : cat?.name ?? 'Tanpa kategori'}
        </p>
      </div>

      <div style={{ paddingTop: '0.8rem' }}>
        <div className="sk-kv">
          <span>Jenis</span>
          <b>{tx.type === 'expense' ? 'Pengeluaran' : tx.type === 'income' ? 'Pendapatan' : 'Transfer'}</b>
        </div>
        <div className="sk-kv">
          <span>{tx.type === 'transfer' ? 'Dari' : 'Rekening'}</span>
          <b>{acc?.name ?? '—'}</b>
        </div>
        {tx.type === 'transfer' ? (
          <>
            <div className="sk-kv">
              <span>Ke</span>
              <b>{dest?.name ?? '—'}</b>
            </div>
            <div className="sk-kv">
              <span>Biaya admin</span>
              <b>{money(tx.fee ?? 0)}</b>
            </div>
          </>
        ) : null}
        <div className="sk-kv">
          <span>Tanggal</span>
          <b>{shortDate(tx.date)}</b>
        </div>
        <div className="sk-kv">
          <span>Catatan</span>
          <b>{tx.note || '—'}</b>
        </div>
      </div>

      <div className="sk-sheet-actions">
        <Button
          label="Hapus"
          variant="destructive"
          onClick={() => {
            removeTx(tx.id);
            notify('Transaksi dihapus', 'info');
            onOpenChange(false);
          }}
        />
        <Button label="Ubah" variant="primary" onClick={() => onEdit(tx)} />
      </div>
    </Dialog>
  );
}
