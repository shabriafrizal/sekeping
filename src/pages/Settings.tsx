import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { useStore } from '../lib/store';
import type { Account, Category, CategoryType } from '../lib/types';
import { money } from '../lib/format';
import { iconFor } from '../lib/icons';

export default function Settings({
  onEditAccount,
  onAddAccount,
  onEditCategory,
  onAddCategory,
  onLock,
}: {
  onEditAccount: (a: Account) => void;
  onAddAccount: () => void;
  onEditCategory: (c: Category) => void;
  onAddCategory: (type: CategoryType) => void;
  onLock: () => void;
}) {
  const { state, updateSettings, balanceOf, exportCSV, exportJSON, replaceState, resetDemo, clearAll, notify, addCategory } =
    useStore();
  const [catTab, setCatTab] = useState<CategoryType>('expense');
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = state.categories.filter((c) => c.type === catTab);
  const currencyOptions = [
    { value: 'IDR', label: 'IDR — Rupiah' },
    { value: 'USD', label: 'USD — Dollar' },
    { value: 'EUR', label: 'EUR — Euro' },
    { value: 'SGD', label: 'SGD — Singapore dollar' },
    { value: 'MYR', label: 'MYR — Ringgit' },
  ];

  function download(name: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Berkas ${name} diunduh`);
  }

  function savePin() {
    if (!/^\d{4}$/.test(pin)) {
      notify('PIN harus 4 angka.', 'error');
      return;
    }
    if (pin !== pin2) {
      notify('Konfirmasi PIN tidak sama.', 'error');
      return;
    }
    updateSettings({ pin });
    setPinOpen(false);
    setPin('');
    setPin2('');
    notify('PIN aktif');
  }

  async function onRestore(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.txs)) {
        throw new Error('format');
      }
      replaceState({ ...parsed, settings: { ...state.settings, ...parsed.settings } });
      notify('Cadangan dipulihkan');
    } catch {
      notify('Berkas cadangan tidak valid.', 'error');
    }
  }

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">Preferensi</p>
          <h1 className="sk-title">Pengaturan</h1>
          <p className="sk-sub">Data tersimpan di perangkatmu sendiri.</p>
        </div>
      </div>

      <section className="sk-card">
        <div className="sk-card-head">
          <h2 className="sk-card-title">Profil</h2>
        </div>
        <div className="sk-two">
          <TextInput
            label="Nama panggilan"
            value={state.settings.userName}
            onChange={(v) => updateSettings({ userName: v })}
            placeholder="Kamu"
          />
          <Selector
            label="Mata uang"
            options={currencyOptions}
            value={state.settings.currency}
            onChange={(v) => updateSettings({ currency: v as typeof state.settings.currency })}
            width="100%"
          />
        </div>
      </section>

      <section className="sk-card">
        <div className="sk-card-head">
          <h2 className="sk-card-title">Rekening</h2>
          <button className="sk-link" type="button" onClick={onAddAccount}>
            + Tambah
          </button>
        </div>
        <div className="sk-rows">
          {state.accounts.map((acc) => {
            const Icon = iconFor(acc.icon);
            return (
              <button key={acc.id} type="button" className="sk-row" onClick={() => onEditAccount(acc)}>
                <span className="sk-row-icon">
                  <Icon />
                </span>
                <span className="sk-row-main">
                  <span className="sk-row-title">
                    {acc.name} {!acc.active ? <em style={{ opacity: 0.6 }}>(nonaktif)</em> : null}
                  </span>
                  <span className="sk-row-meta">Saldo awal {money(acc.initial)}</span>
                </span>
                <span className="sk-row-amount">{money(balanceOf(acc.id))}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sk-card">
        <div className="sk-card-head">
          <h2 className="sk-card-title">Kategori</h2>
          <button className="sk-link" type="button" onClick={() => onAddCategory(catTab)}>
            + Tambah
          </button>
        </div>
        <div className="sk-chips" style={{ marginBottom: '0.5rem' }}>
          <button
            type="button"
            className="sk-chip"
            data-active={catTab === 'expense'}
            onClick={() => setCatTab('expense')}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            className="sk-chip"
            data-active={catTab === 'income'}
            onClick={() => setCatTab('income')}
          >
            Pendapatan
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem' }}>
          {categories.map((cat) => {
            const Icon = iconFor(cat.icon);
            return (
              <button
                key={cat.id}
                type="button"
                className="sk-row"
                style={{ borderBottom: 0, background: 'var(--color-background-muted)' }}
                onClick={() => onEditCategory(cat)}
              >
                <span className="sk-row-icon" style={{ width: '2rem', height: '2rem', borderRadius: 9 }}>
                  <Icon />
                </span>
                <span className="sk-row-main">
                  <span className="sk-row-title">{cat.name}</span>
                  <span className="sk-row-meta">{cat.active ? 'Aktif' : 'Nonaktif'}</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className="sk-row"
            style={{ borderBottom: 0, border: '1px dashed var(--color-border-emphasized)' }}
            onClick={() => {
              addCategory({ name: 'Kategori baru', icon: 'star', type: catTab, active: true });
              notify('Kategori ditambahkan — ketuk untuk mengubah');
            }}
          >
            <span className="sk-row-main" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              + Kategori cepat
            </span>
          </button>
        </div>
      </section>

      <section className="sk-card">
        <div className="sk-card-head">
          <h2 className="sk-card-title">Keamanan</h2>
        </div>
        <div className="sk-kv">
          <span>Kunci PIN</span>
          <b>{state.settings.pin ? 'Aktif' : 'Nonaktif'}</b>
        </div>
        <p className="sk-sub" style={{ fontSize: '0.78rem' }}>
          PIN hanya tersimpan di perangkat ini, bukan di server. Ini pengaman layar, bukan enkripsi data.
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
          {state.settings.pin ? (
            <>
              <Button label="Kunci sekarang" variant="secondary" size="sm" onClick={onLock} />
              <Button
                label="Hapus PIN"
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateSettings({ pin: null });
                  notify('PIN dihapus', 'info');
                }}
              />
            </>
          ) : (
            <Button label="Pasang PIN" variant="secondary" size="sm" onClick={() => setPinOpen(true)} />
          )}
        </div>
      </section>

      <section className="sk-card">
        <div className="sk-card-head">
          <h2 className="sk-card-title">Data</h2>
        </div>
        <div className="sk-kv">
          <span>Total transaksi</span>
          <b>{state.txs.length}</b>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
          <Button
            label="Ekspor CSV"
            variant="secondary"
            size="sm"
            onClick={() => download(`sekeping-${new Date().toISOString().slice(0, 10)}.csv`, exportCSV(), 'text/csv;charset=utf-8')}
          />
          <Button
            label="Cadangkan JSON"
            variant="secondary"
            size="sm"
            onClick={() =>
              download(`sekeping-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJSON(), 'application/json')
            }
          />
          <Button label="Pulihkan" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} />
          <Button
            label="Muat data contoh"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetDemo();
              notify('Data contoh dimuat');
            }}
          />
          <Button
            label="Hapus semua"
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm('Hapus semua transaksi dan catatan? Tindakan ini tidak bisa dibatalkan.')) {
                clearAll();
                notify('Semua data dihapus', 'info');
              }
            }}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onRestore(file);
            e.target.value = '';
          }}
        />
      </section>

      <section className="sk-card">
        <div className="sk-card-head">
          <h2 className="sk-card-title">Tentang Sekeping</h2>
        </div>
        <p className="sk-sub" style={{ fontSize: '0.82rem', marginTop: 0 }}>
          Sekeping adalah aplikasi pencatat keuangan pribadi untuk web. Semua perhitungan berjalan di
          browser dan datanya tetap di perangkatmu — tidak ada akun, tidak ada unggahan.
        </p>
        <p className="sk-sub" style={{ fontSize: '0.72rem' }}>
          Versi 1.0 · dibuat sebagai penerapan ulang mandiri dengan antarmuka dan kode sendiri.
        </p>
      </section>

      <Dialog isOpen={pinOpen} onOpenChange={setPinOpen} purpose="form" width={360}>
        <DialogHeader title="Pasang PIN" subtitle="4 angka, hanya di perangkat ini" onOpenChange={setPinOpen} />
        <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
          <TextInput
            label="PIN baru"
            value={pin}
            onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            type="password"
            placeholder="••••"
          />
          <TextInput
            label="Ulangi PIN"
            value={pin2}
            onChange={(v) => setPin2(v.replace(/\D/g, '').slice(0, 4))}
            type="password"
            placeholder="••••"
          />
        </div>
        <div className="sk-sheet-actions">
          <Button label="Batal" variant="ghost" onClick={() => setPinOpen(false)} />
          <Button label="Aktifkan" variant="primary" onClick={savePin} />
        </div>
      </Dialog>
    </div>
  );
}
