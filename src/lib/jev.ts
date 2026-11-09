import type { Account, Category, TxType } from './types';
import type { ReceiptDraft } from './receipt';
import { t } from './i18n';

interface JevAnswer {
  type: 'choice' | 'noul' | 'score' | string;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  noul?: number;
}

interface JevResponse {
  model?: string;
  answers?: Record<string, JevAnswer>;
  cost?: string;
}

export interface JevResult {
  type?: TxType;
  typeConfidence: number;
  sourceId?: string;
  sourceConfidence: number;
  targetId?: string;
  targetConfidence: number;
  categoryId?: string;
  categoryConfidence: number;
  sure: number;
  model: string;
  reason: string;
  raw: JevResponse;
}

export interface JevFailure {
  status: 'off' | 'busy' | 'unreachable' | 'error';
  message: string;
}

export interface JevAttempt {
  result?: JevResult;
  failure?: JevFailure;
}

export interface JevContext {
  accounts: Account[];
  categories: Category[];
  currency: string;
  today: string;
  baseUrl: string;
  model: string;
}

const TYPE_LABEL: Record<TxType, string> = {
  expense: 'Pengeluaran',
  income: 'Pendapatan',
  transfer: 'Transfer',
};

/** JEV names the destination of the call; a proxy may already include it. */
export function jevEndpoint(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (!clean) {
    const host = typeof window === 'undefined' ? '' : window.location.hostname;
    const local =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local');
    return local ? '/api/jev/systemone' : 'https://opencode.ai/zen/v1/systemone';
  }
  return clean.endsWith('/systemone') ? clean : `${clean}/systemone`;
}

function choice(answer: JevAnswer | undefined, allowed: Set<string>): { id?: string; confidence: number } {
  if (!answer || answer.type !== 'choice' || !answer.choice || !allowed.has(answer.choice)) {
    return { confidence: 0 };
  }
  return {
    id: answer.choice,
    confidence: typeof answer.confidence === 'number' ? answer.confidence : 0,
  };
}

/**
 * Ask the free JEV model on OpenCode Zen which type, accounts and category a
 * receipt belongs to. JEV only returns choices, so the amount and date stay
 * with the local parser.
 */
export async function checkWithJev(text: string, context: JevContext, signal?: AbortSignal): Promise<JevAttempt> {
  const accounts = context.accounts.filter((account) => account.active);
  const categories = context.categories.filter((category) => category.active);
  if (!text.trim()) {
    return { failure: { status: 'off', message: t('Tidak ada teks untuk diperiksa.') } };
  }

  const accountCriteria: Record<string, string> = {};
  for (const account of accounts) accountCriteria[account.id] = t('Rekening {name}', { name: account.name });
  accountCriteria.tidak_tahu = t('Tidak disebut atau tidak jelas');

  const categoryCriteria: Record<string, string> = {};
  for (const category of categories) {
    categoryCriteria[category.id] = `${category.name} (${category.type === 'income' ? t('Pendapatan') : t('Pengeluaran')})`;
  }
  categoryCriteria.tidak_tahu = t('Tidak ada yang cocok');

  const state = [
    `${t('Mata uang')}: ${context.currency}`,
    `${t('Hari ini')}: ${context.today}`,
    `${t('Rekening pengguna')}: ${accounts.map((account) => `${account.id}=${account.name}`).join(', ') || '-'}`,
    `${t('Kategori pengeluaran')}: ${categories.filter((c) => c.type === 'expense').map((c) => `${c.id}=${c.name}`).join(', ') || '-'}`,
    `${t('Kategori pendapatan')}: ${categories.filter((c) => c.type === 'income').map((c) => `${c.id}=${c.name}`).join(', ') || '-'}`,
    '',
    `${t('Teks struk hasil OCR')}:`,
    text.slice(0, 6000),
  ].join('\n');

  const questions: Record<string, unknown> = {
    jenis: {
      type: 'choice',
      instructions: t('Transaksi ini paling tepat dicatat sebagai apa?'),
      criteria: {
        expense: t('Uang keluar untuk barang, jasa, tagihan, atau transfer ke pihak lain yang bukan rekening pengguna.'),
        income: t('Uang masuk sebagai pendapatan, gaji, bonus, refund, atau transfer masuk.'),
        transfer: t('Perpindahan uang antara dua rekening milik pengguna sendiri; rekening asal dan tujuan ada di daftar rekening pengguna.'),
        tidak_yakin: t('Teks tidak cukup jelas untuk menentukan jenis transaksi.'),
      },
    },
    yakin: {
      type: 'noul',
      instructions: t('Teks struk cukup jelas untuk menentukan jenis transaksi dan rekening yang terlibat.'),
    },
  };

  if (accounts.length > 0) {
    questions.sumber = {
      type: 'choice',
      instructions: t('Rekening atau alat bayar asal yang paling mungkin dipakai. Pilih tidak_tahu jika tidak disebut.'),
      criteria: accountCriteria,
    };
    questions.tujuan = {
      type: 'choice',
      instructions: t('Jika ini transfer antar rekening pengguna, rekening tujuan mana? Jika bukan transfer, pilih tidak_tahu.'),
      criteria: accountCriteria,
    };
  }
  if (categories.length > 0) {
    questions.kategori = {
      type: 'choice',
      instructions: t('Kategori paling cocok untuk transaksi ini. Pilih tidak_tahu jika tidak ada yang cocok.'),
      criteria: categoryCriteria,
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  try {
    const response = await fetch(jevEndpoint(context.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: context.model || 'jev-1.13-free',
        state,
        questions,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          failure: {
            status: 'busy',
            message: t('JEV sedang dibatasi (429). Coba lagi nanti; hasil lokal tetap dipakai.'),
          },
        };
      }
      return {
        failure: {
          status: 'error',
          message: t('JEV membalas {status}. Hasil lokal tetap dipakai.', { status: response.status }),
        },
      };
    }

    const data = (await response.json()) as JevResponse;
    const answers = data.answers ?? {};
    const allowedTypes = new Set(['expense', 'income', 'transfer', 'tidak_yakin']);
    const jenis = choice(answers.jenis, allowedTypes);
    const source = accounts.length > 0 ? choice(answers.sumber, new Set(accounts.map((a) => a.id).concat('tidak_tahu'))) : { confidence: 0 };
    const target = accounts.length > 0 ? choice(answers.tujuan, new Set(accounts.map((a) => a.id).concat('tidak_tahu'))) : { confidence: 0 };
    const category =
      categories.length > 0
        ? choice(answers.kategori, new Set(categories.map((c) => c.id).concat('tidak_tahu')))
        : { confidence: 0 };

    const type = jenis.id === 'expense' || jenis.id === 'income' || jenis.id === 'transfer' ? jenis.id : undefined;
    const sure = typeof answers.yakin?.noul === 'number' ? answers.yakin.noul : 0;

    const parts: string[] = [];
    if (type) parts.push(`${t('Jenis')}: ${t(TYPE_LABEL[type])}`);
    if (source.id && source.id !== 'tidak_tahu') {
      const account = accounts.find((candidate) => candidate.id === source.id);
      if (account) parts.push(`${t('Dari')} ${account.name}`);
    }
    if (type === 'transfer' && target.id && target.id !== 'tidak_tahu') {
      const account = accounts.find((candidate) => candidate.id === target.id);
      if (account) parts.push(`${t('Ke')} ${account.name}`);
    }
    if (type && type !== 'transfer' && category.id && category.id !== 'tidak_tahu') {
      const found = categories.find((candidate) => candidate.id === category.id);
      if (found) parts.push(`${t('Kategori')} ${found.name}`);
    }
    if (jenis.confidence > 0) parts.push(`${t('Keyakinan')} ${Math.round(jenis.confidence * 100)}%`);

    return {
      result: {
        type,
        typeConfidence: jenis.confidence,
        sourceId: source.id && source.id !== 'tidak_tahu' ? source.id : undefined,
        sourceConfidence: source.confidence,
        targetId: target.id && target.id !== 'tidak_tahu' ? target.id : undefined,
        targetConfidence: target.confidence,
        categoryId: category.id && category.id !== 'tidak_tahu' ? category.id : undefined,
        categoryConfidence: category.confidence,
        sure,
        model: data.model || context.model || 'jev-1.13-free',
        reason: parts.join(' · '),
        raw: data,
      },
    };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      failure: {
        status: 'unreachable',
        message: aborted
          ? t('JEV tidak menjawab dalam 15 detik. Hasil lokal tetap dipakai.')
          : t('JEV tidak bisa dihubungi dari browser ini (CORS/jaringan). Hasil lokal tetap dipakai.'),
      },
    };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function categoryForType(categories: Category[], type: TxType): Category | undefined {
  if (type === 'transfer') return undefined;
  return categories.find((category) => category.active && category.type === type);
}

/**
 * Let JEV override a local guess only when the answer is a valid part of the
 * ledger. Missing or low-confidence answers keep the local value.
 */
export function applyJev(
  draft: ReceiptDraft,
  result: JevResult,
  context: { accounts: Account[]; categories: Category[] },
): ReceiptDraft {
  const next: ReceiptDraft = {
    ...draft,
    signals: [...draft.signals],
    matches: { ...draft.matches },
  };
  const accounts = context.accounts.filter((account) => account.active);
  const categories = context.categories.filter((category) => category.active);

  if (result.type && result.typeConfidence >= 0.45) {
    next.type = result.type;
    next.matches.type = true;
  }

  if (result.sourceId) {
    const account = accounts.find((candidate) => candidate.id === result.sourceId);
    if (account) {
      next.accountId = account.id;
      next.matches.account = true;
    }
  }

  if (next.type === 'transfer') {
    const target = accounts.find((candidate) => candidate.id === result.targetId && candidate.id !== next.accountId);
    if (target) {
      next.toAccountId = target.id;
    } else if (!next.toAccountId || next.toAccountId === next.accountId) {
      next.toAccountId = accounts.find((candidate) => candidate.id !== next.accountId)?.id ?? '';
    }
    if (!next.toAccountId) {
      next.type = 'expense';
      next.toAccountId = '';
    }
    next.categoryId = '';
  } else {
    next.toAccountId = '';
    const chosen = categories.find(
      (category) => category.id === result.categoryId && category.type === next.type,
    );
    const current = categories.find(
      (category) => category.id === next.categoryId && category.type === next.type,
    );
    const fallback = categoryForType(categories, next.type);
    if (chosen && result.categoryConfidence >= 0.4) {
      next.categoryId = chosen.id;
      next.matches.category = true;
    } else if (!current && fallback) {
      next.categoryId = fallback.id;
    }
  }

  next.confidence = Math.max(
    next.confidence,
    Math.min(0.96, Math.max(result.typeConfidence, result.sure, 0.5)),
  );

  if (result.reason) next.signals.push(t('JEV: {reason}', { reason: result.reason }));
  return next;
}
