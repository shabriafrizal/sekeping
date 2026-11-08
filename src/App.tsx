import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Selector } from '@astryxdesign/core/Selector';
import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { TopNav } from '@astryxdesign/core/TopNav';
import { Section } from '@astryxdesign/core/Section';
import { Center } from '@astryxdesign/core/Center';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { currentMonth, useStore } from './lib/store';
import type { Account, Budget, Category, CategoryType, Debt, DebtKind, Recurring, Tx, TxType } from './lib/types';
import { money } from './lib/format';
import { CURRENCY_OPTIONS, LANGUAGE_OPTIONS } from './lib/settings-options';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Debts from './pages/Debts';
import Settings from './pages/Settings';
import RecurringPage from './pages/Recurring';
import Budgets from './pages/Budgets';
import ImportPage from './pages/Import';
import TransactionSheet from './sheets/TransactionSheet';
import TxDetail from './sheets/TxDetail';
import { AccountSheet, CategorySheet, DebtSheet, PaymentSheet } from './sheets/EntitySheets';
import { RecurringSheet } from './sheets/RecurringSheet';
import { BudgetSheet } from './sheets/BudgetSheet';
import WidgetConfigSheet from './sheets/WidgetConfigSheet';
import { iconFor } from './lib/icons';
import { closeSheet, nativeMode, openApp, signalReady, syncWidgetAccounts, syncWidgetSummary, toast } from './lib/native';
import { daysUntilNext } from './lib/recurring';
import Tour, { type TourStep } from './components/Tour';

type Page = 'home' | 'transactions' | 'recurring' | 'budgets' | 'reports' | 'debts' | 'import' | 'settings';

/* The APK opens this build in a modal surface when a widget button or the
   "Atur widget" dialog asks for it. */
const NATIVE_MODE = nativeMode();
const SHEET_START = (() => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('sheet');
  if (type === 'expense' || type === 'income' || type === 'transfer') {
    return { type: type as TxType, accountId: params.get('account') || undefined };
  }
  return null;
})();

const NAV: Array<{ id: Page; label: string; icon: string; short?: string }> = [
  { id: 'home', label: 'Ringkasan', icon: 'house', short: 'h' },
  { id: 'transactions', label: 'Transaksi', icon: 'receipt', short: 't' },
  { id: 'recurring', label: 'Rutin', icon: 'repeat', short: 'r' },
  { id: 'budgets', label: 'Anggaran', icon: 'budget', short: 'b' },
  { id: 'reports', label: 'Laporan', icon: 'pie', short: 'l' },
  { id: 'debts', label: 'Utang & Piutang', icon: 'arrows', short: 'd' },
];

const MAIN_IDS: Page[] = ['home', 'transactions', 'reports', 'debts'];
const PLAN_IDS: Page[] = ['recurring', 'budgets'];

const MORE_NAV: Array<{ id: Page; label: string; hint: string; icon: string }> = [
  { id: 'recurring', label: 'Rutin & langganan', hint: 'Jadwal transaksi otomatis', icon: 'repeat' },
  { id: 'budgets', label: 'Anggaran', hint: 'Batas bulanan per kategori', icon: 'budget' },
  { id: 'debts', label: 'Utang & piutang', hint: 'Cicilan dan pinjaman', icon: 'arrows' },
  { id: 'import', label: 'Impor CSV', hint: 'Pemetaan kolom dari bank', icon: 'receipt' },
  { id: 'settings', label: 'Pengaturan', hint: 'Profil, data, dan keamanan', icon: 'house' },
];

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'Alt + 1…6', label: 'Langsung ke halaman (urutan menu)' },
  { keys: 'g lalu h', label: 'Ringkasan' },
  { keys: 'g lalu t', label: 'Transaksi' },
  { keys: 'g lalu r', label: 'Rutin & langganan' },
  { keys: 'g lalu b', label: 'Anggaran' },
  { keys: 'g lalu l', label: 'Laporan' },
  { keys: 'g lalu d', label: 'Utang & piutang' },
  { keys: 'g lalu s', label: 'Pengaturan' },
  { keys: 'n', label: 'Catat pengeluaran baru' },
  { keys: '?', label: 'Buka atau tutup daftar pintasan ini' },
  { keys: 'Esc', label: 'Tutup dialog' },
  { keys: 'Tab / Shift + Tab', label: 'Pindah antar kontrol' },
  { keys: '↑ ↓ ← →', label: 'Pindah antar item menu' },
];

/* Each target lists the desktop and the mobile home of the same control. */
const TOUR_STEPS: TourStep[] = [
  {
    target: ['[data-tour="balance"]'],
    title: 'Saldo semua rekening',
    body: 'Angka ini berubah setiap kali kamu mencatat transaksi. Di bawahnya, uang masuk dan keluar bulan ini.',
  },
  {
    target: ['[data-tour="accounts"]'],
    title: 'Rekeningmu',
    body: 'Dompet, bank, dan dompet digital. Tiap rekening menghitung saldonya sendiri.',
  },
  {
    target: ['[data-tour="add"]'],
    title: 'Catat transaksi',
    body: 'Tekan di sini untuk pengeluaran, pemasukan, atau transfer antar rekening.',
  },
  {
    target: ['[data-tour="month"]'],
    title: 'Bulan ini',
    body: 'Tingkat tabungan, pola belanja tujuh hari, dan kategori paling boros.',
  },
  {
    target: ['.astryx-side-nav'],
    title: 'Semua ada di sini',
    body: 'Transaksi, laporan, utang dan piutang. Pengaturan berisi ekspor dan cadangan.',
  },
];

export default function App() {
  const store = useStore();
  const { state, toasts, dismissToast, updateSettings, clearAll, resetDemo, runRecurring, notify } = store;

  const [page, setPage] = useState<Page>('home');
  const reminderCount = state.recurring.filter(
    (r) => r.active && r.type === 'expense' && daysUntilNext(r) <= 7 && (!r.endDate || r.nextDate <= r.endDate),
  ).length;
  const [locked, setLocked] = useState<boolean>(Boolean(state.settings.pin));
  const [tourOpen, setTourOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);
  const gRef = useRef(0);
  const postedRef = useRef(false);

  const [txSheet, setTxSheet] = useState<{
    open: boolean;
    tx: Tx | null;
    type: TxType;
    accountId?: string;
  }>({
    open: Boolean(SHEET_START),
    tx: null,
    type: SHEET_START?.type ?? 'expense',
    accountId: SHEET_START?.accountId,
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
  const [recSheet, setRecSheet] = useState<{ open: boolean; item: Recurring | null }>({ open: false, item: null });
  const [budgetSheet, setBudgetSheet] = useState<{ open: boolean; budget: Budget | null; categoryId?: string }>({
    open: false,
    budget: null,
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  /* Keyboard users land on the page heading, not back at the top of the menu. */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [page]);

  /* Catch up on recurring transactions once per session, after unlocking. */
  useEffect(() => {
    if (NATIVE_MODE === 'config') return;
    if (!state.settings.onboarded || locked || postedRef.current) return;
    postedRef.current = true;
    const count = runRecurring();
    if (count > 0) notify(`${count} transaksi berulang dicatat otomatis`, 'info');
  }, [state.settings.onboarded, locked, runRecurring, notify]);

  /* Global shortcuts: Alt+1…6 jumps, g-prefix jumps, n adds, ? shows help. */
  useEffect(() => {
    if (NATIVE_MODE) return;
    function go(id: Page) {
      setPage(id);
      setHelpOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const typing = Boolean(target) && (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || Boolean(target?.isContentEditable));
      const modal = document.querySelector('.astryx-dialog[open], .sk-tour');
      if (modal) return;
      if (e.defaultPrevented) return;

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !typing) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= NAV.length) {
          e.preventDefault();
          go(NAV[n - 1].id);
          return;
        }
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }
      if (e.key === 'n') {
        e.preventDefault();
        setTxSheet({ open: true, tx: null, type: 'expense' });
        return;
      }
      if (e.key === 'g') {
        gRef.current = Date.now();
        return;
      }
      if (Date.now() - gRef.current < 1200) {
        const map: Record<string, Page> = {
          h: 'home',
          t: 'transactions',
          r: 'recurring',
          b: 'budgets',
          l: 'reports',
          d: 'debts',
          i: 'import',
          s: 'settings',
        };
        const destination = map[e.key.toLowerCase()];
        gRef.current = 0;
        if (destination) {
          e.preventDefault();
          go(destination);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Arrow keys move between menu items without leaving the menu. */
  function onNavKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-nav]')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (forward ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
  }

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

  /* Keep the Android widget's account picker and summary in sync with the ledger. */
  useEffect(() => {
    syncWidgetAccounts(state.accounts);
  }, [state.accounts]);

  /* The store applies number/date formatting before render; the document
     language is only an accessibility hint and can update afterwards. */
  useEffect(() => {
    document.documentElement.lang = state.settings.language;
  }, [state.settings.language]);

  useEffect(() => {
    if (NATIVE_MODE === 'config') return;
    const { from, to } = currentMonth();
    let income = 0;
    let expense = 0;
    for (const tx of state.txs) {
      if (tx.date < from || tx.date > to) continue;
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    }
    const currency = state.settings.currency;
    syncWidgetSummary({
      total: money(store.netWorth, currency),
      monthIn: `+${money(income, currency)}`,
      monthOut: `−${money(expense, currency)}`,
      currency,
      language: state.settings.language,
      accounts: state.accounts
        .filter((a) => a.active)
        .map((a) => ({
          id: a.id,
          name: a.name,
          icon: a.icon,
          balance: money(store.balanceOf(a.id), currency),
        })),
    });
  }, [
    state.txs,
    state.accounts,
    state.settings.currency,
    state.settings.language,
    store.netWorth,
  ]);

  /* A sheet opened before onboarding has no ledger to write to: hand off to
     the full app, which shows the welcome screen. */
  useEffect(() => {
    if (NATIVE_MODE === 'sheet' && !state.settings.onboarded) openApp();
  }, [state.settings.onboarded]);

  /* A widget tap waits for onboarding and the PIN screen to finish. */
  useEffect(() => {
    if (!queuedAdd || !state.settings.onboarded || locked) return;
    openAdd(queuedAdd.type, queuedAdd.accountId);
    setQueuedAdd(null);
  }, [queuedAdd, state.settings.onboarded, locked]);

  /* The tour introduces the interface once, right after onboarding. */
  useEffect(() => {
    if (NATIVE_MODE) return;
    if (!state.settings.onboarded || state.settings.tourSeen || locked) return;
    const timer = window.setTimeout(() => setTourOpen(true), 450);
    return () => window.clearTimeout(timer);
  }, [state.settings.onboarded, state.settings.tourSeen, locked]);

  function startTour() {
    setPage('home');
    window.scrollTo({ top: 0 });
    setTourOpen(true);
  }

  function endTour() {
    setTourOpen(false);
    updateSettings({ tourSeen: true });
    window.scrollTo({ top: 0 });
  }

  function editTx(tx: Tx) {
    setDetail(null);
    setTxSheet({ open: true, tx, type: tx.type });
  }

  /* The widget setup dialog: a real Astryx dialog on a transparent window. */
  if (NATIVE_MODE === 'config') {
    return <WidgetConfigSheet locked={Boolean(state.settings.pin)} />;
  }

  /* The quick-add sheet: the same transaction dialog as the app, floating over
     the home screen instead of opening the dashboard. */
  if (NATIVE_MODE === 'sheet') {
    if (!state.settings.onboarded) return null;
    return (
      <div className="sk-native-surface">
        {locked ? (
          <div className="sk-native-lock">
            <button type="button" className="sk-native-dismiss" onClick={closeSheet} aria-label="Tutup">
              Batal
            </button>
            <LockScreen
              value={pin}
              error={pinError}
              onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
              onDelete={() => setPin((p) => p.slice(0, -1))}
              onDigitError={() => setPinError(true)}
            />
          </div>
        ) : (
          <TransactionSheet
            isOpen={txSheet.open}
            onOpenChange={(open) => {
              setTxSheet((s) => ({ ...s, open }));
              /* Let the state commit and the widget summary reach the host
                 before the activity is torn down. */
              if (!open) window.setTimeout(closeSheet, 240);
            }}
            tx={null}
            initialType={SHEET_START?.type}
            initialAccountId={SHEET_START?.accountId}
            onSaved={(message) => {
              toast(message);
            }}
          />
        )}
      </div>
    );
  }

  if (!state.settings.onboarded) {
    return (
      <Start
        onDemo={() => {
          const { language, currency } = state.settings;
          resetDemo();
          updateSettings({ onboarded: true, language, currency });
        }}
        onEmpty={() => {
          const { language, currency } = state.settings;
          clearAll();
          updateSettings({ onboarded: true, language, currency });
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
    <AppShell
      variant="surface"
      height="auto"
      contentPadding={0}
      topNav={
        <TopNav
          label="Navigasi utama"
          heading={
            <HStack gap={2} vAlign="center">
              <span className="sk-brand-mark sk-brand-mark--sm">
                <LogoGlyph />
              </span>
              <VStack gap={0}>
                <Text weight="semibold">Sekeping</Text>
                <Text type="supporting" size="2xs">
                  {money(store.netWorth)}
                </Text>
              </VStack>
            </HStack>
          }
          endContent={
            <span data-tour="add" data-add="expense">
              <Button
                label="Tambah"
                size="sm"
                variant="primary"
                icon={<PlusGlyph />}
                onClick={() => openAdd('expense')}
              />
            </span>
          }
        />
      }
      sideNav={
        <SideNav
          topContent={
            <span data-tour="add" data-add="expense" className="sk-add-wrap">
              <Button
                label="Tambah transaksi"
                variant="primary"
                width="100%"
                icon={<PlusGlyph />}
                onClick={() => openAdd('expense')}
              />
            </span>
          }
          footer={
            <SideNavSection title="Akun">
              <SideNavItem
                label="Pintasan"
                icon={iconFor('key')}
                endContent={<Badge label="?" />}
                onClick={() => setHelpOpen(true)}
              />
              <SideNavItem
                label="Pengaturan"
                icon={iconFor('cog')}
                isSelected={page === 'settings'}
                onClick={() => setPage('settings')}
              />
            </SideNavSection>
          }
        >
          <SideNavSection title="Menu">
            {NAV.filter((item) => MAIN_IDS.includes(item.id)).map((item) => {
              const Icon = iconFor(item.icon);
              const count =
                item.id === 'home' ? reminderCount : item.id === 'debts' ? state.debts.length : 0;
              return (
                <SideNavItem
                  key={item.id}
                  label={item.label}
                  icon={Icon}
                  isSelected={page === item.id}
                  endContent={count > 0 ? <Badge label={String(count)} /> : undefined}
                  onClick={() => setPage(item.id)}
                />
              );
            })}
          </SideNavSection>

          <SideNavSection title="Perencanaan">
            {NAV.filter((item) => PLAN_IDS.includes(item.id)).map((item) => {
              const Icon = iconFor(item.icon);
              const due =
                item.id === 'recurring'
                  ? state.recurring.filter(
                      (r) => r.active && r.nextDate <= new Date().toISOString().slice(0, 10),
                    ).length
                  : 0;
              return (
                <SideNavItem
                  key={item.id}
                  label={item.label}
                  icon={Icon}
                  isSelected={page === item.id}
                  endContent={due > 0 ? <Badge label={String(due)} variant="warning" /> : undefined}
                  onClick={() => setPage(item.id)}
                />
              );
            })}
            <SideNavItem
              label="Impor CSV"
              icon={iconFor('receipt')}
              isSelected={page === 'import'}
              onClick={() => setPage('import')}
            />
          </SideNavSection>
        </SideNav>
      }
    >
      <Section padding={4} paddingBlock={5}>
        <Center axis="horizontal">
          <VStack gap={4} maxWidth={1120} width="100%">
            <div id="sk-main" ref={mainRef} tabIndex={-1} className="sk-main-focus">
              {page === 'home' ? (
                <Home onAdd={openAdd} onOpenTx={setDetail} onNavigate={(p) => setPage(p as Page)} />
              ) : null}
              {page === 'transactions' ? <Transactions onAdd={openAdd} onOpenTx={setDetail} /> : null}
              {page === 'recurring' ? (
                <RecurringPage
                  onAdd={() => setRecSheet({ open: true, item: null })}
                  onEdit={(item) => setRecSheet({ open: true, item })}
                />
              ) : null}
              {page === 'budgets' ? (
                <Budgets
                  onAdd={(categoryId) => setBudgetSheet({ open: true, budget: null, categoryId })}
                  onEdit={(budget) => setBudgetSheet({ open: true, budget })}
                />
              ) : null}
              {page === 'import' ? <ImportPage onNavigate={(p) => setPage(p as Page)} /> : null}
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
                  onTour={startTour}
                  onNavigate={(p) => setPage(p as Page)}
                  onShortcuts={() => setHelpOpen(true)}
                />
              ) : null}
            </div>
          </VStack>
        </Center>
      </Section>

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

      <RecurringSheet
        isOpen={recSheet.open}
        onOpenChange={(open) => setRecSheet((s) => ({ ...s, open }))}
        item={recSheet.item}
      />

      <BudgetSheet
        isOpen={budgetSheet.open}
        onOpenChange={(open) => setBudgetSheet((s) => ({ ...s, open }))}
        budget={budgetSheet.budget}
        initialCategoryId={budgetSheet.categoryId}
      />

      <Dialog isOpen={helpOpen} onOpenChange={setHelpOpen} purpose="info" width={460}>
        <DialogHeader title="Pintasan keyboard" subtitle="Bekerja tanpa mouse" onOpenChange={setHelpOpen} />
        <div className="sk-shortcuts">
          {SHORTCUTS.map((item) => (
            <div className="sk-shortcut" key={item.keys}>
              <span className="sk-kbd">{item.keys}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <p className="sk-sub" style={{ fontSize: '0.74rem' }}>
          Pintasan nonaktif saat kamu mengetik di kolom isian. Dialog selalu bisa ditutup dengan Esc.
        </p>
      </Dialog>

      {tourOpen ? <Tour steps={TOUR_STEPS} onDone={endTour} /> : null}

      <div className="sk-toasts" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} type="button" className="sk-toast" data-tone={t.tone} onClick={() => dismissToast(t.id)}>
            {t.tone === 'error' ? <WarnGlyph /> : <CheckGlyph />}
            {t.message}
          </button>
        ))}
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function Start({ onDemo, onEmpty }: { onDemo: () => void; onEmpty: () => void }) {
  const { state, updateSettings } = useStore();
  const { language, currency } = state.settings;

  return (
    <div className="sk-start">
      <div className="sk-start-card">
        <span className="sk-brand-mark sk-start-mark">
          <LogoGlyph />
        </span>
        <h1 className="sk-start-name">Sekeping</h1>
        <p className="sk-start-line">Catatan keuangan yang tenang.</p>
        <span className="sk-start-rule" aria-hidden="true" />

        <div className="sk-start-settings">
          <Selector
            label="Bahasa"
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(v) => updateSettings({ language: v as typeof language })}
            width="100%"
          />
          <Selector
            label="Mata uang"
            options={CURRENCY_OPTIONS}
            value={currency}
            onChange={(v) => updateSettings({ currency: v as typeof currency })}
            width="100%"
          />
        </div>
        <p className="sk-start-sample" aria-live="polite">
          {language === 'en' ? 'Sample' : 'Contoh'}: {money(1_234_567)}
        </p>

        <button type="button" className="sk-start-primary" data-start="empty" onClick={onEmpty}>
          Mulai dari kosong
        </button>
        <button type="button" className="sk-start-secondary" data-start="demo" onClick={onDemo}>
          Lihat data contoh
        </button>
        <p className="sk-start-note">Mulai tanpa data. Data contoh hanya dimuat jika kamu memilihnya.</p>
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
