import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { useStore } from '../lib/store';
import type { Account, Category, Tx, TxType } from '../lib/types';
import { uid } from '../lib/types';
import { money } from '../lib/format';
import {
  CSV_FIELDS,
  CSV_TEMPLATE,
  buildImport,
  guessMapping,
  parseCsv,
  type CsvMapping,
  type CsvTable,
  type DateFormat,
} from '../lib/csv';
import { t } from '../lib/i18n';

const DELIMITER_LABEL: Record<string, string> = {
  ',': 'koma',
  ';': 'titik koma',
  '\t': 'tab',
  '|': 'pipa',
};

const TYPE_LABEL: Record<TxType, string> = {
  expense: t("Pengeluaran"),
  income: t("Pendapatan"),
  transfer: t("Transfer"),
};

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ImportPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { state, importData, notify } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [paste, setPaste] = useState('');
  const [defaultType, setDefaultType] = useState<TxType>('expense');
  const [dateFormat, setDateFormat] = useState<DateFormat>('auto');
  const [inferSign, setInferSign] = useState(false);
  const [dedupe, setDedupe] = useState(true);
  const [createMissing, setCreateMissing] = useState(true);
  const [defaultAccountId, setDefaultAccountId] = useState(state.accounts.find((a) => a.active)?.id ?? '');
  const [imported, setImported] = useState(0);

  const activeAccounts = state.accounts.filter((a) => a.active);

  function loadText(text: string, name: string) {
    try {
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        notify('Berkas tidak berisi baris data.', 'error');
        return;
      }
      setTable(parsed);
      setMapping(guessMapping(parsed.headers));
      setFileName(name);
      setImported(0);
    } catch {
      notify('Berkas CSV tidak bisa dibaca.', 'error');
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    loadText(text, file.name);
  }

  const preview = useMemo(() => {
    if (!table) return null;
    return buildImport(
      table,
      mapping,
      { type: defaultType, dateFormat, inferSign, dedupe },
      state.txs,
    );
  }, [table, mapping, defaultType, dateFormat, inferSign, dedupe, state.txs]);

  const mappingComplete = mapping.date !== undefined && mapping.amount !== undefined;

  function runImport() {
    if (!table || !preview) return;
    const accountByName = new Map(state.accounts.map((a) => [a.name.trim().toLowerCase(), a]));
    const categoryByName = new Map(
      state.categories.map((c) => [`${c.type}:${c.name.trim().toLowerCase()}`, c]),
    );
    const newAccounts: Account[] = [];
    const newCategories: Category[] = [];

    const resolveAccount = (name: string): string => {
      const key = name.trim().toLowerCase();
      if (!key) return defaultAccountId || activeAccounts[0]?.id || '';
      const found = accountByName.get(key);
      if (found) return found.id;
      if (!createMissing) return defaultAccountId || activeAccounts[0]?.id || '';
      const created: Account = { id: uid('acc'), name: name.trim(), icon: 'wallet', initial: 0, active: true };
      newAccounts.push(created);
      accountByName.set(key, created);
      return created.id;
    };

    const resolveCategory = (name: string, type: 'expense' | 'income'): string | undefined => {
      const key = name.trim().toLowerCase();
      if (!key) return undefined;
      const mapKey = `${type}:${key}`;
      const found = categoryByName.get(mapKey);
      if (found) return found.id;
      if (!createMissing) return undefined;
      const created: Category = { id: uid('cat'), name: name.trim(), icon: 'star', type, active: true };
      newCategories.push(created);
      categoryByName.set(mapKey, created);
      return created.id;
    };

    const txs: Tx[] = [];
    preview.rows.forEach((row, i) => {
      if (row.error || row.duplicate) return;
      const accountId = resolveAccount(row.account);
      if (!accountId) return;
      const categoryId =
        row.type === 'expense' || row.type === 'income'
          ? resolveCategory(row.category, row.type)
          : undefined;
      const toAccountId = row.type === 'transfer' ? resolveAccount(row.toAccount) : undefined;
      txs.push({
        id: uid('tx'),
        type: row.type,
        amount: row.amount,
        accountId,
        categoryId,
        toAccountId,
        fee: row.type === 'transfer' ? row.fee : 0,
        date: row.date,
        note: row.note,
        createdAt: Date.now() + i,
      });
    });

    if (txs.length === 0) {
      notify('Tidak ada baris yang bisa diimpor.', 'error');
      return;
    }
    importData({ accounts: newAccounts, categories: newCategories, txs });
    setImported(txs.length);
    setTable(null);
    setFileName('');
    setPaste('');
    notify(`${txs.length} transaksi diimpor`);
  }

  return (
    <div className="sk-page">
      <div className="sk-page-head">
        <div>
          <p className="sk-eyebrow">{t("Data masuk")}</p>
          <h1 className="sk-title">{t("Impor CSV")}</h1>
          <p className="sk-sub">{t("Petakan kolom dari bank atau aplikasi lain, lalu periksa sebelum menyimpan.")}</p>
        </div>
        <Button label={t("Kembali ke transaksi")} variant="ghost" onClick={() => onNavigate('transactions')} />
      </div>

      {imported > 0 && !table ? (
        <section className="sk-card" role="status">
          <div className="sk-card-head">
            <h2 className="sk-card-title">{imported} transaksi diimpor</h2>
          </div>
          <p className="sk-sub" style={{ marginTop: 0 }}>{t("Semua baris yang valid sudah masuk ke buku. Baris duplikat dan bermasalah dilewati.")}</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
            <Button label={t("Lihat transaksi")} variant="secondary" size="sm" onClick={() => onNavigate('transactions')} />
            <Button label={t("Impor berkas lain")} variant="ghost" size="sm" onClick={() => setImported(0)} />
          </div>
        </section>
      ) : null}

      <section className="sk-card" aria-labelledby="import-file">
        <div className="sk-card-head">
          <h2 className="sk-card-title" id="import-file">{t("1. Pilih berkas")}</h2>
          <button
            type="button"
            className="sk-link"
            onClick={() => download('sekeping-contoh-impor.csv', CSV_TEMPLATE, 'text/csv;charset=utf-8')}
          >{t("Unduh contoh")}</button>
        </div>
        <div
          className="sk-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void onFile(file);
          }}
        >
          <p className="sk-drop-title">
            {table ? (
              <>
                <strong>{fileName}</strong> · {table.rows.length} baris · pemisah {DELIMITER_LABEL[table.delimiter] ?? table.delimiter}
              </>
            ) : (
              'Tarik berkas .csv ke sini'
            )}
          </p>
          <p className="sk-sub" style={{ marginTop: 0 }}>
            {t('File tetap diproses di perangkat ini; tidak ada yang diunggah.')}
          </p>
          <Button label={t("Pilih berkas CSV")} variant="secondary" size="sm" onClick={() => fileRef.current?.click()} />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sk-visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
              e.target.value = '';
            }}
          />
        </div>

        <details className="sk-details">
          <summary>{t("Atau tempel teks CSV")}</summary>
          <label className="sk-field" style={{ marginTop: '0.6rem' }}>
            <span className="sk-eyebrow">{t("Teks CSV")}</span>
            <textarea
              className="sk-input sk-textarea"
              rows={5}
              value={paste}
              placeholder={t("Tanggal,Jenis,Kategori,Rekening,Jumlah,Catatan…")}
              onChange={(e) => setPaste(e.target.value)}
            />
          </label>
          <Button
            label={t("Gunakan teks ini")}
            variant="secondary"
            size="sm"
            isDisabled={paste.trim().length === 0}
            onClick={() => loadText(paste, 'Tempelan CSV')}
          />
        </details>
      </section>

      {table ? (
        <>
          <section className="sk-card" aria-labelledby="import-map">
            <div className="sk-card-head">
              <h2 className="sk-card-title" id="import-map">{t("2. Petakan kolom")}</h2>
              <button type="button" className="sk-link" onClick={() => setMapping(guessMapping(table.headers))}>{t("Tebak ulang")}</button>
            </div>
            <div className="sk-map-grid">
              {CSV_FIELDS.map((field) => (
                <Selector
                  key={field.key}
                  label={field.required ? `${t(field.label)} *` : t(field.label)}
                  options={[
                    { value: '', label: '— tidak dipakai —' },
                    ...table.headers.map((header, i) => ({
                      value: String(i),
                      label: `${header} (contoh: ${table.rows[0]?.[i]?.slice(0, 24) || '—'})`,
                    })),
                  ]}
                  value={mapping[field.key] === undefined ? '' : String(mapping[field.key])}
                  onChange={(v) =>
                    setMapping((prev) => {
                      const next = { ...prev };
                      if (v === '') delete next[field.key];
                      else next[field.key] = Number(v);
                      return next;
                    })
                  }
                  width="100%"
                />
              ))}
            </div>
            {!mappingComplete ? (
              <p className="sk-inline-warning" role="status">{t("Tanggal dan jumlah wajib dipetakan sebelum bisa diimpor.")}</p>
            ) : null}
            <div className="sk-two" style={{ marginTop: '0.8rem' }}>
              <Selector
                label={t("Jenis bawaan")}
                options={[
                  { value: 'expense', label: t("Pengeluaran") },
                  { value: 'income', label: t("Pendapatan") },
                  { value: 'transfer', label: t("Transfer") },
                ]}
                value={defaultType}
                onChange={(v) => setDefaultType(v as TxType)}
                width="100%"
              />
              <Selector
                label={t("Format tanggal")}
                options={[
                  { value: 'auto', label: 'Deteksi otomatis' },
                  { value: 'ymd', label: 'Tahun-Bulan-Hari' },
                  { value: 'dmy', label: 'Hari/Bulan/Tahun' },
                  { value: 'mdy', label: 'Bulan/Hari/Tahun' },
                ]}
                value={dateFormat}
                onChange={(v) => setDateFormat(v as DateFormat)}
                width="100%"
              />
            </div>
            <div className="sk-two" style={{ marginTop: '0.6rem' }}>
              <Selector
                label={t("Rekening bawaan")}
                options={activeAccounts.map((a) => ({ value: a.id, label: a.name }))}
                value={defaultAccountId}
                onChange={setDefaultAccountId}
                width="100%"
              />
              <div className="sk-field">
                <span className="sk-eyebrow">{t("Opsi")}</span>
                <label className="sk-check" style={{ padding: '0.5rem 0.65rem' }}>
                  <input type="checkbox" checked={inferSign} onChange={(e) => setInferSign(e.target.checked)} />
                  <span>
                    <b>{t("Arah dari tanda angka")}</b>
                    <small>Negatif = pengeluaran, positif = pendapatan. Abaikan kolom jenis.</small>
                  </span>
                </label>
              </div>
            </div>
            <div className="sk-opts">
              <label className="sk-check">
                <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
                <span>
                  <b>{t("Lewati duplikat")}</b>
                  <small>{t("Baris dengan tanggal, jenis, jumlah, dan catatan yang sama tidak diimpor ulang.")}</small>
                </span>
              </label>
              <label className="sk-check">
                <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
                <span>
                  <b>Buat rekening & kategori baru</b>
                  <small>{t("Nama yang belum ada ditambahkan otomatis, bukan dibuang.")}</small>
                </span>
              </label>
            </div>
          </section>

          {preview ? (
            <section className="sk-card" aria-labelledby="import-preview">
              <div className="sk-card-head">
                <h2 className="sk-card-title" id="import-preview">
                  3. Periksa & impor
                </h2>
                <span className="sk-badge" data-tone={preview.errors ? 'error' : 'success'}>
                  {preview.valid} siap
                </span>
              </div>
              <div className="sk-chips" style={{ marginBottom: '0.6rem' }}>
                <span className="sk-badge" data-tone="success">
                  {preview.valid} valid
                </span>
                <span className="sk-badge">{preview.duplicates} duplikat</span>
                <span className="sk-badge" data-tone={preview.errors ? 'error' : undefined}>
                  {preview.errors} bermasalah
                </span>
              </div>

              <div className="sk-table-wrap" tabIndex={0} role="region" aria-label={t("Pratinjau impor, dapat digulir")}>
                <table className="sk-table">
                  <caption className="sk-visually-hidden">
                    Pratinjau {preview.rows.length} baris, {preview.valid} siap diimpor
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("Baris")}</th>
                      <th scope="col">{t("Tanggal")}</th>
                      <th scope="col">{t("Jenis")}</th>
                      <th scope="col">{t("Jumlah")}</th>
                      <th scope="col">{t("Kategori")}</th>
                      <th scope="col">{t("Rekening")}</th>
                      <th scope="col">{t("Catatan")}</th>
                      <th scope="col">{t("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 30).map((row) => (
                      <tr key={row.line} data-tone={row.error ? 'error' : row.duplicate ? 'muted' : undefined}>
                        <td>{row.line}</td>
                        <td>{row.date || '—'}</td>
                        <td>{TYPE_LABEL[row.type]}</td>
                        <td className="sk-num">{row.amount ? money(row.amount) : '—'}</td>
                        <td>{row.category || '—'}</td>
                        <td>{row.account || '—'}</td>
                        <td>{row.note || '—'}</td>
                        <td>
                          {row.error ? (
                            <span className="sk-badge" data-tone="error">
                              {row.error}
                            </span>
                          ) : row.duplicate ? (
                            <span className="sk-badge">{t("Duplikat")}</span>
                          ) : (
                            <span className="sk-badge" data-tone="success">{t("Siap")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 30 ? (
                <p className="sk-sub">Menampilkan 30 dari {preview.rows.length} baris.</p>
              ) : null}

              <div className="sk-sheet-actions">
                <Button label={t("Batalkan")} variant="ghost" onClick={() => setTable(null)} />
                <Button
                  label={`Impor ${preview.valid} transaksi`}
                  variant="primary"
                  isDisabled={preview.valid === 0 || !mappingComplete}
                  onClick={runImport}
                />
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
