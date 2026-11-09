import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import type { Account, AiSettings, Category, TxType } from '../lib/types';
import type { ReceiptDraft } from '../lib/receipt';
import { parseReceiptText } from '../lib/receipt';
import { applyJev, checkWithJev, type JevAttempt, type JevFailure } from '../lib/jev';
import { recogniseReceipt, type OcrProgress } from '../lib/ocr';
import { parseAmountInput } from '../lib/format';
import { iconFor } from '../lib/icons';
import { t } from '../lib/i18n';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  accounts: Account[];
  categories: Category[];
  ai: AiSettings;
  defaultAccountId?: string;
  onApply: (draft: ReceiptDraft) => void;
}

type Phase = 'pick' | 'reading' | 'review' | 'error';
type AiState =
  | { status: 'off' | 'checking' }
  | { status: 'ok'; model: string; reason: string }
  | { status: 'error'; failure: JevFailure };

const TYPE_LABEL: Record<TxType, string> = {
  expense: 'Pengeluaran',
  income: 'Pendapatan',
  transfer: 'Transfer',
};

function friendlyStatus(status: string): string {
  if (status === 'loading') return t('Memuat model PaddleOCR…');
  if (status === 'detecting') return t('Mendeteksi teks struk…');
  if (status === 'recognizing') return t('Membaca teks struk…');
  return t('Menyiapkan…');
}

export default function ScanSheet({
  isOpen,
  onOpenChange,
  currency,
  accounts,
  categories,
  ai,
  defaultAccountId,
  onApply,
}: Props) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [preview, setPreview] = useState('');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [aiState, setAiState] = useState<AiState>({ status: 'off' });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef('');
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const activeAccounts = accounts.filter((account) => account.active);
  const activeCategories = categories.filter((category) => category.active);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isOpen) return;
    abortRef.current?.abort();
    setPhase('pick');
    setProgress(0);
    setStatus('');
    setError('');
    setText('');
    setDraft(null);
    setAiState({ status: 'off' });
    setManualOpen(false);
    setManualText('');
    setDragging(false);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
    setPreview('');
  }, [isOpen]);

  function showPreview(file: File) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
  }

  function localDraft(raw: string): ReceiptDraft {
    return parseReceiptText(raw, {
      accounts,
      categories,
      currency,
      defaultAccountId,
    });
  }

  async function runAi(raw: string) {
    if (!ai.enabled) {
      setAiState({ status: 'off' });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiState({ status: 'checking' });
    const attempt: JevAttempt = await checkWithJev(
      raw,
      {
        accounts,
        categories,
        currency,
        today: new Date().toISOString().slice(0, 10),
        baseUrl: ai.baseUrl,
        model: ai.model,
      },
      controller.signal,
    );
    if (!aliveRef.current || controller.signal.aborted) return;
    if (attempt.result) {
      const result = attempt.result;
      setDraft((current) =>
        current ? applyJev(current, result, { accounts, categories }) : current,
      );
      setAiState({ status: 'ok', model: result.model, reason: result.reason });
    } else if (attempt.failure) {
      setAiState({ status: 'error', failure: attempt.failure });
    }
  }

  async function readFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError(t('Pilih berkas gambar (JPG, PNG, atau HEIC).'));
      setPhase('error');
      return;
    }
    abortRef.current?.abort();
    showPreview(file);
    setPhase('reading');
    setProgress(0);
    setStatus(t('Menyiapkan gambar…'));
    setError('');
    setText('');
    setDraft(null);
    setAiState({ status: 'off' });

    try {
      const raw = await recogniseReceipt(file, (update: OcrProgress) => {
        if (!aliveRef.current) return;
        setProgress(Math.max(0, Math.min(1, update.progress)));
        setStatus(friendlyStatus(update.status));
      });
      if (!aliveRef.current) return;
      if (!raw.trim()) {
        setError(t('Tidak ada teks yang terbaca. Coba foto lebih terang dan tegak, atau tempel teksnya manual.'));
        setPhase('error');
        return;
      }
      const parsed = localDraft(raw);
      setText(raw);
      setDraft(parsed);
      setPhase('review');
      await runAi(raw);
    } catch (cause) {
      if (!aliveRef.current) return;
      console.error(cause);
      setError(t('Mesin OCR gagal dimuat. Periksa koneksi aset OCR, lalu coba lagi.'));
      setPhase('error');
    }
  }

  function useManualText() {
    const raw = manualText.trim();
    if (!raw) return;
    const parsed = localDraft(raw);
    setText(raw);
    setDraft(parsed);
    setPhase('review');
    void runAi(raw);
  }

  function setType(nextType: TxType) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, type: nextType, matches: { ...current.matches } };
      if (nextType === 'transfer') {
        next.categoryId = '';
        next.toAccountId =
          activeAccounts.find((account) => account.id !== next.accountId)?.id ?? '';
      } else {
        next.toAccountId = '';
        const category = activeCategories.find((item) => item.type === nextType);
        if (!activeCategories.some((item) => item.id === next.categoryId && item.type === nextType)) {
          next.categoryId = category?.id ?? '';
        }
      }
      return next;
    });
  }

  function update<K extends keyof ReceiptDraft>(key: K, value: ReceiptDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  const categoryOptions = activeCategories
    .filter((category) => category.type === draft?.type)
    .map((category) => ({ value: category.id, label: category.name, icon: iconFor(category.icon) }));

  const accountOptions = activeAccounts.map((account) => ({
    value: account.id,
    label: account.name,
    icon: iconFor(account.icon),
  }));

  const canApply = Boolean(
    draft &&
      draft.amount > 0 &&
      draft.accountId &&
      (draft.type === 'transfer'
        ? draft.toAccountId && draft.toAccountId !== draft.accountId
        : draft.categoryId),
  );

  function apply() {
    if (!draft || !canApply) return;
    onApply(draft);
    onOpenChange(false);
  }

  function reset() {
    abortRef.current?.abort();
    setPhase('pick');
    setText('');
    setDraft(null);
    setError('');
    setProgress(0);
    setAiState({ status: 'off' });
    setManualOpen(false);
    setManualText('');
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
    setPreview('');
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={560} maxHeight="92dvh">
      <DialogHeader
        title={t('Scan struk')}
        subtitle={t('Foto → teks → periksa → simpan')}
        onOpenChange={onOpenChange}
      />

      <div className="sk-dialog-body">
        <div className="sk-sheet sk-scan-sheet">
          {phase === 'pick' ? (
            <>
              <div
                className="sk-scan-drop"
                data-dragging={dragging}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') fileRef.current?.click();
                }}
              >
                <span className="sk-scan-drop-icon" aria-hidden="true">
                  <CameraGlyph />
                </span>
                <strong>{t('Pilih foto struk atau transfer')}</strong>
                <span>{t('JPG, PNG, atau HEIC. Foto diproses di perangkat ini dengan PaddleOCR.')}</span>
                <span className="sk-scan-drop-hint">{t('Ketuk untuk memilih dari galeri atau kamera')}</span>
              </div>

              {preview ? <img className="sk-scan-preview" src={preview} alt={t('Pratinjau struk')} /> : null}

              <input
                ref={fileRef}
                className="sk-visually-hidden"
                type="file"
                accept="image/*"
                data-testid="scan-file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                  event.target.value = '';
                }}
              />

              <div className="sk-scan-manual">
                <button
                  type="button"
                  className="sk-link"
                  onClick={() => setManualOpen((open) => !open)}
                >
                  {manualOpen ? t('Tutup tempel teks') : t('Tempel teks manual')}
                </button>
                {manualOpen ? (
                  <div className="sk-field" style={{ marginTop: '0.5rem' }}>
                    <textarea
                      className="sk-input sk-scan-textarea"
                      rows={5}
                      value={manualText}
                      placeholder={t('Tempel teks dari struk di sini…')}
                      onChange={(event) => setManualText(event.target.value)}
                    />
                    <Button
                      label={t('Periksa teks ini')}
                      variant="secondary"
                      size="sm"
                      onClick={useManualText}
                      isDisabled={!manualText.trim()}
                    />
                  </div>
                ) : null}
              </div>

              <p className="sk-scan-note">
                {t('OCR berjalan lokal dengan PaddleOCR (PP-OCRv5). Tidak ada gambar yang diunggah.')}
                {ai.enabled
                  ? ` ${t('Teks saja dikirim ke JEV untuk memeriksa jenis dan tujuan transaksi.')}`
                  : ` ${t('JEV nonaktif; pemeriksaan memakai aturan lokal.')}`}
              </p>
            </>
          ) : null}

          {phase === 'reading' ? (
            <div className="sk-scan-reading" aria-live="polite">
              {preview ? <img className="sk-scan-preview" src={preview} alt={t('Pratinjau struk')} /> : null}
              <div className="sk-scan-progress-track">
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="sk-scan-status">{status || t('Membaca struk…')}</p>
              <p className="sk-scan-pct">{Math.round(progress * 100)}%</p>
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="sk-scan-error" role="alert">
              <span className="sk-scan-error-icon" aria-hidden="true">
                <WarnGlyph />
              </span>
              <strong>{t('Scan belum berhasil')}</strong>
              <p>{error}</p>
              <div className="sk-scan-actions">
                <Button label={t('Pilih foto lain')} variant="secondary" onClick={() => fileRef.current?.click()} />
                <Button
                  label={t('Tempel teks manual')}
                  variant="ghost"
                  onClick={() => {
                    setManualOpen(true);
                    setPhase('pick');
                  }}
                />
              </div>
            </div>
          ) : null}

          {phase === 'review' && draft ? (
            <div className="sk-scan-result" data-testid="scan-review">
              <div className="sk-scan-head">
                {preview ? <img className="sk-scan-thumb" src={preview} alt={t('Pratinjau struk')} /> : null}
                <div className="sk-scan-head-copy">
                  <div className="sk-scan-badges">
                    <span className="sk-scan-badge" data-tone="local">
                      {t('Teks OCR')}
                    </span>
                    <span className="sk-scan-badge" data-tone={aiState.status === 'ok' ? 'ai' : 'muted'}>
                      {aiState.status === 'ok'
                        ? t('JEV · {model}', { model: aiState.model })
                        : aiState.status === 'checking'
                          ? t('JEV memeriksa…')
                          : t('Aturan lokal')}
                    </span>
                  </div>
                  <p className="sk-scan-confidence">
                    {t('Keyakinan')} <b>{Math.round(draft.confidence * 100)}%</b>
                  </p>
                  <div className="sk-scan-confidence-track">
                    <span style={{ width: `${Math.round(draft.confidence * 100)}%` }} />
                  </div>
                </div>
              </div>

              {aiState.status === 'ok' ? (
                <p className="sk-scan-ai" data-tone="ok">
                  <SparkGlyph /> {aiState.reason || t('JEV sudah memeriksa arah transaksi.')}
                </p>
              ) : null}
              {aiState.status === 'checking' ? (
                <p className="sk-scan-ai" data-tone="busy">
                  <SparkGlyph /> {t('JEV sedang memeriksa jenis, rekening, dan kategori…')}
                </p>
              ) : null}
              {aiState.status === 'error' ? (
                <p className="sk-scan-ai" data-tone="warn">
                  <WarnGlyph /> {aiState.failure.message}
                </p>
              ) : null}
              {aiState.status === 'off' ? (
                <p className="sk-scan-ai" data-tone="muted">
                  {t('JEV nonaktif. Aktifkan di Pengaturan → Pemindaian & AI untuk pemeriksaan arah otomatis.')}
                </p>
              ) : null}

              <div className="sk-type-row sk-scan-types">
                <div className="sk-type-group" role="radiogroup" aria-label={t('Jenis transaksi')}>
                  {(['expense', 'income', 'transfer'] as TxType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={draft.type === type}
                      className="sk-type-btn"
                      data-tone={type}
                      data-active={draft.type === type}
                      onClick={() => setType(type)}
                    >
                      {t(TYPE_LABEL[type])}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sk-two">
                <TextInput
                  label={t('Jumlah')}
                  value={draft.amount ? String(draft.amount) : ''}
                  inputMode="decimal"
                  placeholder="0"
                  onChange={(value) => update('amount', parseAmountInput(value, currency))}
                />
                <Selector
                  label={t('Rekening')}
                  options={accountOptions}
                  value={draft.accountId}
                  onChange={(value) => update('accountId', value)}
                  width="100%"
                />
              </div>

              {draft.type === 'transfer' ? (
                <Selector
                  label={t('Ke rekening')}
                  options={accountOptions.filter((option) => option.value !== draft.accountId)}
                  value={draft.toAccountId}
                  onChange={(value) => update('toAccountId', value)}
                  width="100%"
                />
              ) : (
                <Selector
                  label={t('Kategori')}
                  options={categoryOptions}
                  value={draft.categoryId}
                  onChange={(value) => update('categoryId', value)}
                  width="100%"
                />
              )}

              <div className="sk-two">
                <label className="sk-field">
                  <span className="sk-eyebrow">{t('Tanggal')}</span>
                  <input
                    className="sk-input"
                    type="date"
                    value={draft.date}
                    onChange={(event) => update('date', event.target.value)}
                  />
                </label>
                <label className="sk-field">
                  <span className="sk-eyebrow">{t('Waktu · opsional')}</span>
                  <input
                    className="sk-input"
                    type="time"
                    value={draft.time}
                    onChange={(event) => update('time', event.target.value)}
                  />
                </label>
              </div>

              <TextInput
                label={t('Catatan')}
                value={draft.note}
                placeholder={t('Opsional')}
                onChange={(value) => update('note', value)}
              />

              {draft.signals.length > 0 ? (
                <ul className="sk-scan-signals">
                  {draft.signals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              ) : null}

              <div className="sk-scan-actions">
                <Button label={t('Scan ulang')} variant="ghost" size="sm" onClick={reset} />
                {ai.enabled ? (
                  <Button
                    label={t('Periksa ulang dengan JEV')}
                    variant="secondary"
                    size="sm"
                    onClick={() => void runAi(text)}
                    isDisabled={aiState.status === 'checking'}
                  />
                ) : null}
              </div>

              <details className="sk-scan-raw">
                <summary>{t('Lihat teks OCR')}</summary>
                <pre>{text}</pre>
              </details>

              <p className="sk-scan-confirm-note">
                {t('Periksa dulu. Setelah “Gunakan data”, kamu masih bisa mengubah semuanya di formulir transaksi sebelum menyimpan.')}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="sk-sheet-actions">
        <Button label={t('Batal')} variant="ghost" onClick={() => onOpenChange(false)} />
        <Button
          label={t('Gunakan data')}
          variant="primary"
          onClick={apply}
          isDisabled={!canApply}
          data-testid="scan-apply"
        />
      </div>
    </Dialog>
  );
}

function CameraGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.4A1.5 1.5 0 0 1 9.9 4h4.2a1.5 1.5 0 0 1 1.1.6L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" strokeLinejoin="round" />
      <circle cx="12" cy="12.4" r="3.1" />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
      <path d="m12 3 1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3Z" strokeLinejoin="round" />
      <path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" strokeLinejoin="round" />
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
