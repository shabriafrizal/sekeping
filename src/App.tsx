import { useEffect, useState } from 'react';
import { useStore } from './lib/store';
import type { Account, Category, CategoryType, Debt, DebtKind, Tx, TxType } from './lib/types';
import { money } from './lib/format';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Debts from './pages/Debts';
import Settings from './pages/Settings';
import TransactionSheet from './sheets/TransactionSheet';
import TxDetail from './sheets/TxDetail';
import { AccountSheet, CategorySheet, DebtSheet, PaymentSheet } from './sheets/EntitySheets';
import { iconFor } from './lib/icons';
import { signalReady, syncWidgetAccounts } from './lib/native';

type Page = 'home' | 'transactions' | 'reports' | 'debts' | 'settings';

const NAV: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'home', label: 'Ringkasan', icon: 'house' },
  { id: 'transactions', label: 'Transaksi', icon: 'receipt' },
  { id: 'reports', label: 'Laporan', icon: 'pie' },
  { id: 'debts', label: 'Utang & Piutang', icon: 'arrows' },
];

export default function App() {
  const store = useStore();
  const { state, toasts, dismissToast, updateSettings, clearAll } = store;

  const [page, setPage] = useState<Page>('home');
  const [locked, setLocked] = useState<boolean>(Boolean(state.settings.pin));
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const [txSheet, setTxSheet] = useState<{
    open: boolean;
    tx: Tx | null;
    type: TxType;
    accountId?: string;
  }>({
    open: false,
    tx: null,
    type: 'expense',
  });
  const [queuedAdd, setQueuedAdd] = useState<{ type: TxType; accountId?: string } | null>(null);
  const [detail, setDetail] = useState<Tx | null>(null);
  const [accountSheet, setAccountSheet] = useState<{ open: boolean; account: Account | null }>({
    open: false,
    account: null,
  });
  const [categorySheet, setCategorySheet] = useState<{
    open: boolean;
    category: Category | null;
    type: CategoryType;
  }>({ open: false, category: null, type: 'expense' });
  const [debtSheet, setDebtSheet] = useState<{ open: boolean; debt: Debt | null; kind: DebtKind }>({
    open: false,
    debt: null,
    kind: 'debt',
  });
  const [paySheet, setPaySheet] = useState<{ open: boolean; debt: Debt | null }>({ open: false, debt: null });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    if (pin.length < 4) return;
    if (pin === state.settings.pin) {
      setLocked(false);
      setPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
      window.setTimeout(() => setPinError(false), 600);
    }
  }, [pin, state.settings.pin]);

  function openAdd(type: TxType = 'expense', accountId?: string) {
    setTxSheet({ open: true, tx: null, type, accountId });
  }

  /* Widget / launcher shortcuts: ?add=expense&account=acc_x */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const add = params.get('add');
    if (add === 'expense' || add === 'income' || add === 'transfer') {
      setQueuedAdd({ type: add, accountId: params.get('account') || undefined });
      window.history.replaceState({}, '', window.location.pathname);
    }
    window.SekepingOpenAdd = (type, accountId) => {
      if (type === 'expense' || type === 'income' || type === 'transfer') {
        setQueuedAdd({ type, accountId: accountId || undefined });
      }
    };
    signalReady();
    return () => {
      delete window.SekepingOpenAdd;
    };
  }, []);

  /* Keep the Android widget's account picker in sync with the ledger. */
  useEffect(() => {
    syncWidgetAccounts(state.accounts);
  }, [state.accounts]);

  /* A widget tap waits for onboarding and the PIN screen to finish. */
  useEffect(() => {
    if (!queuedAdd || !state.settings.onboarded || locked) return;
    openAdd(queuedAdd.type, queuedAdd.accountId);
    setQueuedAdd(null);
  }, [queuedAdd, state.settings.onboarded, locked]);

  function editTx(tx: Tx) {
    setDetail(null);
    setTxSheet({ open: true, tx, type: tx.type });
  }

  if (!state.settings.onboarded) {
    return (
      <Onboarding
        onDemo={() => updateSettings({ onboarded: true })}
        onEmpty={() => {
          clearAll();
          updateSettings({ onboarded: true });
        }}
      />
    );
  }

  if (locked) {
    return (
      <LockScreen
        value={pin}
        error={pinError}
        onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
        onDelete={() => setPin((p) => p.slice(0, -1))}
        onDigitError={() => setPinError(true)}
      />
    );
  }

  return (
    <div className="sk-app">
      <aside className="sk-sidebar">
        <div className="sk-brand">
          <span className="sk-brand-mark">
            <LogoGlyph />
          </span>
          <div>
            <div className="sk-brand-name">Sekeping</div>
            <div className="sk-brand-tag">catatan keuangan</div>
          </div>
        </div>

        <nav className="sk-nav" aria-label="Navigasi utama">
          <p className="sk-nav-label">Menu</p>
          {NAV.map((item) => {
            const Icon = iconFor(item.icon);
            return (
              <button
                key={item.id}
                type="button"
                className="sk-nav-item"
                data-active={page === item.id}
                data-nav={item.id}
                onClick={() => setPage(item.id)}
              >
                <Icon />
                <span>{item.label}</span>
                {item.id === 'debts' ? (
                  <span className="sk-nav-count">{state.debts.filter((d) => !d.kind || true).length}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sk-sidebar-foot">
          <button type="button" className="sk-nav-item" data-active="false" data-add="expense" onClick={() => openAdd('expense')}>
            <span
              style={{
                width: '1.2rem',
                height: '1.2rem',
                borderRadius: 6,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--color-accent)',
                color: 'var(--color-on-accent)',
                fontSize: '0.9rem',
                lineHeight: 1,
              }}
            >
              +
            </span>
            <span>Tambah transaksi</span>
          </button>

          <div className="sk-mini-account">
            <span className="sk-account-icon" style={{ width: '2rem', height: '2rem' }}>
              <WalletGlyph />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{money(store.netWorth)}</strong>
              <span>{state.accounts.filter((a) => a.active).length} rekening aktif</span>
            </div>
          </div>

          <button type="button" className="sk-nav-item" data-nav="settings" data-active={page === 'settings'} onClick={() => setPage('settings')}>
            <GearGlyph />
            <span>Pengaturan</span>
          </button>
        </div>
      </aside>

      <main className="sk-main">
        <div className="sk-mobile-top">
          <div className="sk-brand">
            <span className="sk-brand-mark" style={{ width: '2rem', height: '2rem', borderRadius: 11 }}>
              <LogoGlyph />
            </span>
            <div>
              <div className="sk-brand-name" style={{ fontSize: '1.1rem' }}>
                Sekeping
              </div>
              <div className="sk-brand-tag">{money(store.netWorth)}</div>
            </div>
          </div>
          <button
            type="button"
            className="sk-tab"
            aria-label="Pengaturan"
            onClick={() => setPage('settings')}
            style={{ color: page === 'settings' ? 'var(--color-accent)' : undefined }}
          >
            <GearGlyph />
          </button>
        </div>

        {page === 'home' ? (
          <Home onAdd={openAdd} onOpenTx={setDetail} onNavigate={(p) => setPage(p as Page)} />
        ) : null}
        {page === 'transactions' ? <Transactions onAdd={openAdd} onOpenTx={setDetail} /> : null}
        {page === 'reports' ? <Reports /> : null}
        {page === 'debts' ? (
          <Debts
            onAdd={(kind) => setDebtSheet({ open: true, debt: null, kind })}
            onEdit={(debt) => setDebtSheet({ open: true, debt, kind: debt.kind })}
            onPay={(debt) => setPaySheet({ open: true, debt })}
          />
        ) : null}
        {page === 'settings' ? (
          <Settings
            onEditAccount={(account) => setAccountSheet({ open: true, account })}
            onAddAccount={() => setAccountSheet({ open: true, account: null })}
            onEditCategory={(category) => setCategorySheet({ open: true, category, type: category.type })}
            onAddCategory={(type) => setCategorySheet({ open: true, category: null, type })}
            onLock={() => setLocked(true)}
          />
        ) : null}
      </main>

      <nav className="sk-tabbar" aria-label="Navigasi bawah">
        <button type="button" className="sk-tab" data-active={page === 'home'} data-nav="home" onClick={() => setPage('home')}>
          <NavIcon name="house" />
          <span>Ringkasan</span>
        </button>
        <button
          type="button"
          className="sk-tab"
          data-active={page === 'transactions'}
          data-nav="transactions"
          onClick={() => setPage('transactions')}
        >
          <NavIcon name="receipt" />
          <span>Transaksi</span>
        </button>
        <button type="button" className="sk-tab-add" aria-label="Tambah transaksi" data-add="expense" onClick={() => openAdd('expense')}>
          <PlusGlyph />
        </button>
        <button
          type="button"
          className="sk-tab"
          data-active={page === 'reports'}
          data-nav="reports"
          onClick={() => setPage('reports')}
        >
          <NavIcon name="pie" />
          <span>Laporan</span>
        </button>
        <button
          type="button"
          className="sk-tab"
          data-active={page === 'debts'}
          data-nav="debts"
          onClick={() => setPage('debts')}
        >
          <NavIcon name="arrows" />
          <span>Utang</span>
        </button>
      </nav>

      <TransactionSheet
        isOpen={txSheet.open}
        onOpenChange={(open) => setTxSheet((s) => ({ ...s, open }))}
        tx={txSheet.tx}
        initialType={txSheet.type}
        initialAccountId={txSheet.accountId}
      />

      <TxDetail tx={detail} isOpen={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} onEdit={editTx} />

      <AccountSheet
        isOpen={accountSheet.open}
        onOpenChange={(open) => setAccountSheet((s) => ({ ...s, open }))}
        account={accountSheet.account}
      />

      <CategorySheet
        isOpen={categorySheet.open}
        onOpenChange={(open) => setCategorySheet((s) => ({ ...s, open }))}
        category={categorySheet.category}
        initialType={categorySheet.type}
      />

      <DebtSheet
        isOpen={debtSheet.open}
        onOpenChange={(open) => setDebtSheet((s) => ({ ...s, open }))}
        debt={debtSheet.debt}
        kind={debtSheet.kind}
      />

      <PaymentSheet
        isOpen={paySheet.open}
        onOpenChange={(open) => setPaySheet((s) => ({ ...s, open }))}
        debt={paySheet.debt}
      />

      <div className="sk-toasts" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} type="button" className="sk-toast" data-tone={t.tone} onClick={() => dismissToast(t.id)}>
            {t.tone === 'error' ? <WarnGlyph /> : <CheckGlyph />}
            {t.message}
          </button>
        ))}
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */

function Onboarding({ onDemo, onEmpty }: { onDemo: () => void; onEmpty: () => void }) {
  return (
    <div className="sk-onboard">
      <div className="sk-onboard-art">
        <div className="sk-brand" style={{ padding: 0 }}>
          <span className="sk-brand-mark" style={{ background: 'rgba(246,242,233,0.15)' }}>
            <LogoGlyph />
          </span>
          <div>
            <div className="sk-brand-name" style={{ color: '#f6f2e9' }}>
              Sekeping
            </div>
            <div className="sk-brand-tag" style={{ color: 'rgba(246,242,233,0.7)' }}>
              catatan keuangan
            </div>
          </div>
        </div>
        <div>
          <h2>Uangmu, dalam satu pandangan yang tenang.</h2>
          <p style={{ opacity: 0.78, maxWidth: 340, lineHeight: 1.6 }}>
            Catat pengeluaran tanpa ribet, lihat ke mana uang pergi, dan pantau utang-piutang — semuanya
            tersimpan di perangkat ini.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.72rem', opacity: 0.7 }}>
          <span>Tanpa akun</span>
          <span>Tanpa unggahan</span>
          <span>Bisa diekspor</span>
        </div>
      </div>
      <div className="sk-onboard-copy">
        <p className="sk-eyebrow">Selamat datang</p>
        <h1>Mulai mencatat dalam satu menit.</h1>
        <ul>
          <li>
            <CheckGlyph /> Rekening, kategori, dan transaksi
          </li>
          <li>
            <CheckGlyph /> Laporan kategori &amp; tren bulanan
          </li>
          <li>
            <CheckGlyph /> Utang, piutang, dan cicilan
          </li>
          <li>
            <CheckGlyph /> Ekspor CSV dan cadangan JSON
          </li>
        </ul>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" className="sk-chip" data-active="true" style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }} onClick={onDemo}>
            Lihat dengan data contoh
          </button>
          <button type="button" className="sk-chip" style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }} onClick={onEmpty}>
            Mulai dari kosong
          </button>
        </div>
        <p className="sk-sub" style={{ fontSize: '0.72rem' }}>
          Data contoh bisa dihapus kapan saja dari Pengaturan.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lock screen                                                         */
/* ------------------------------------------------------------------ */

function LockScreen({
  value,
  error,
  onDigit,
  onDelete,
  onDigitError,
}: {
  value: string;
  error: boolean;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onDigitError: () => void;
}) {
  return (
    <div className="sk-lock">
      <div className="sk-lock-card">
        <span className="sk-brand-mark" style={{ width: '3rem', height: '3rem', borderRadius: 16 }}>
          <LogoGlyph />
        </span>
        <div>
          <h2 className="sk-title" style={{ textAlign: 'center' }}>
            Masukkan PIN
          </h2>
          <p className="sk-sub">Sekeping terkunci di perangkat ini.</p>
        </div>
        <div className="sk-pin-dots" style={{ outline: error ? '2px solid var(--color-error)' : 'none', borderRadius: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="sk-pin-dot" data-filled={i < value.length} />
          ))}
        </div>
        <div className="sk-pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="sk-key" onClick={() => onDigit(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="sk-key" data-variant="util" onClick={onDigitError} aria-hidden="true" tabIndex={-1}>
            ·
          </button>
          <button type="button" className="sk-key" onClick={() => onDigit('0')}>
            0
          </button>
          <button type="button" className="sk-key" data-variant="util" onClick={onDelete} aria-label="Hapus">
            ⌫
          </button>
        </div>
        {error ? <p className="sk-sub" style={{ color: 'var(--color-error)' }}>PIN salah, coba lagi.</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Glyphs                                                              */
/* ------------------------------------------------------------------ */

function NavIcon({ name }: { name: string }) {
  const Icon = iconFor(name);
  return <Icon />;
}

function LogoGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 9.5h13.5a1 1 0 0 1 1 1V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.2" cy="12.6" r="1.1" fill="currentColor" />
    </svg>
  );
}
function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function GearGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  );
}
function WalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.3 2.3 4.7-4.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WarnGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M12 4 3 20h18L12 4Z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
