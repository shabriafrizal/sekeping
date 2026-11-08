import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { useStore } from '../lib/store';
import type { Account, AppState, Category, CategoryType } from '../lib/types';
import { money } from '../lib/format';
import { iconFor } from '../lib/icons';
import { decryptJson, encryptJson, isEncryptedExport } from '../lib/crypto';

const RepeatIcon = iconFor('repeat');
const BudgetIcon = iconFor('budget');

export default function Settings({
  onEditAccount,
  onAddAccount,
  onEditCategory,
  onAddCategory,
  onLock,
  onNavigate,
  onShortcuts,
  onTour,
}: {
  onEditAccount: (a: Account) => void;
  onAddAccount: () => void;
  onEditCategory: (c: Category) => void;
  onAddCategory: (type: CategoryType) => void;
  onLock: () => void;
  onNavigate: (page: string) => void;
  onShortcuts: () => void;
  onTour: () => void;
}) {
  const { state, updateSettings, balanceOf, exportCSV, exportJSON, replaceState, resetDemo, clearAll, notify, addCategory } =
    useStore();
  const [catTab, setCatTab] = useState<CategoryType>('expense');
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportPassword2, setExportPassword2] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [unlock, setUnlock] = useState<{ text: string; name: string } | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);
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

  function applyRestore(parsed: AppState) {
    if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.txs)) {
      throw new Error('format');
    }
    replaceState({
      ...parsed,
      recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      settings: { ...state.settings, ...parsed.settings },
    });
    notify('Cadangan dipulihkan');
  }

  async function onRestore(file: File) {
    try {
      const text = await file.text();
      if (isEncryptedExport(text)) {
        setUnlock({ text, name: file.name });
        setUnlockPassword('');
        return;
      }
      applyRestore(JSON.parse(text));
    } catch {
      notify('Berkas cadangan tidak valid.', 'error');
    }
  }

  async function doEncryptedExport() {
    if (exportPassword.length < 8) {
      notify('Kata sandi minimal 8 karakter.', 'error');
      return;
    }
    if (exportPassword !== exportPassword2) {
      notify('Konfirmasi kata sandi tidak sama.', 'error');
      return;
    }
    setExportBusy(true);
    try {
      const text = await encryptJson(state, exportPassword);
      download(`sekeping-${new Date().toISOString().slice(0, 10)}.sekeping`, text, 'application/octet-stream');
      setExportOpen(false);
      setExportPassword('');
      setExportPassword2('');
    } catch {
      notify('Ekspor terenkripsi gagal di perangkat ini.', 'error');
    } finally {
      setExportBusy(false);
    }
  }

  async function doUnlock() {
    if (!unlock) return;
    setUnlockBusy(true);
    try {
      const parsed = (await decryptJson(unlock.text, unlockPassword)) as AppState;
      applyRestore(parsed);
      setUnlock(null);
      setUnlockPassword('');
    } catch {
      setUnlockPassword('');
      notify('Kata sandi salah atau berkas rusak.', 'error');
    } finally {
      setUnlockBusy(false);
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
          <h2 className="sk-card-title">Perencanaan</h2>
        </div>
        <div className="sk-rows">
          <button type="button" className="sk-row" onClick={() => onNavigate('recurring')}>
            <span className="sk-row-icon">
              <RepeatIcon />
            </span>
            <span className="sk-row-main">
              <span className="sk-row-title">Rutin &amp; langganan</span>
              <span className="sk-row-meta">
                {state.recurring.filter((r) => r.active).length} jadwal aktif · transaksi otomatis
              </span>
            </span>
          </button>
          <button type="button" className="sk-row" onClick={() => onNavigate('budgets')}>
            <span className="sk-row-icon">
              <BudgetIcon />
            </span>
            <span className="sk-row-main">
              <span className="sk-row-title">Anggaran</span>
              <span className="sk-row-meta">{state.budgets.filter((b) => b.active).length} kategori dengan batas bulanan</span>
            </span>
          </button>
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
          PIN hanya tersimpan di perangkat ini, bukan di server. Ini pengaman layar, bukan enkripsi data — untuk
          cadangan yang terkunci, gunakan <b>Ekspor terenkripsi</b> di bagian Data.
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
        <div className="sk-kv">
          <span>Jadwal berulang</span>
          <b>{state.recurring.length}</b>
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
          <Button label="Ekspor terenkripsi" variant="secondary" size="sm" onClick={() => setExportOpen(true)} />
          <Button label="Impor CSV" variant="secondary" size="sm" onClick={() => onNavigate('import')} />
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
        <p className="sk-sub" style={{ fontSize: '0.74rem', marginTop: '0.55rem' }}>
          Ekspor terenkripsi memakai AES-GCM dengan kunci dari kata sandimu (PBKDF2). Tanpa kata sandi, berkas
          tidak bisa dibuka — simpan baik-baik.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.sekeping,application/json,text/plain"
          className="sk-visually-hidden"
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
          Versi 1.1 · dibuat sebagai penerapan ulang mandiri dengan antarmuka dan kode sendiri.
        </p>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Button label="Tur antarmuka" variant="ghost" size="sm" onClick={onTour} />
          <Button label="Pintasan keyboard (?)" variant="ghost" size="sm" onClick={onShortcuts} />
        </div>
      </section>

      <Dialog isOpen={exportOpen} onOpenChange={setExportOpen} purpose="form" width={420}>
        <DialogHeader
          title="Ekspor terenkripsi"
          subtitle="Cadangan JSON yang dikunci kata sandi"
          onOpenChange={setExportOpen}
        />
        <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
          <p className="sk-sub" style={{ marginTop: 0, fontSize: '0.8rem' }}>
            Berkas <code>.sekeping</code> ini memuat semua rekening, transaksi, jadwal, dan anggaran. Tanpa kata
            sandi, isinya tidak bisa dipulihkan.
          </p>
          <TextInput
            label="Kata sandi (min. 8 karakter)"
            value={exportPassword}
            onChange={setExportPassword}
            type="password"
            placeholder="••••••••"
          />
          <TextInput
            label="Ulangi kata sandi"
            value={exportPassword2}
            onChange={setExportPassword2}
            type="password"
            placeholder="••••••••"
          />
        </div>
        <div className="sk-sheet-actions">
          <Button label="Batal" variant="ghost" onClick={() => setExportOpen(false)} />
          <Button
            label={exportBusy ? 'Mengenkripsi…' : 'Unduh terenkripsi'}
            variant="primary"
            isDisabled={exportBusy}
            onClick={doEncryptedExport}
          />
        </div>
      </Dialog>

      <Dialog isOpen={Boolean(unlock)} onOpenChange={(open) => !open && setUnlock(null)} purpose="form" width={420}>
        <DialogHeader
          title="Buka cadangan terenkripsi"
          subtitle={unlock?.name}
          onOpenChange={(open) => !open && setUnlock(null)}
        />
        <div className="sk-sheet" style={{ paddingTop: '1rem' }}>
          <p className="sk-sub" style={{ marginTop: 0, fontSize: '0.8rem' }}>
            Masukkan kata sandi yang dipakai saat mengekspor. Kata sandi tidak disimpan di mana pun.
          </p>
          <TextInput
            label="Kata sandi"
            value={unlockPassword}
            onChange={setUnlockPassword}
            type="password"
            placeholder="••••••••"
          />
        </div>
        <div className="sk-sheet-actions">
          <Button label="Batal" variant="ghost" onClick={() => setUnlock(null)} />
          <Button
            label={unlockBusy ? 'Membuka…' : 'Pulihkan'}
            variant="primary"
            isDisabled={unlockBusy || unlockPassword.length === 0}
            onClick={doUnlock}
          />
        </div>
      </Dialog>

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
