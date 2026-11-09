import type { Worker } from 'tesseract.js';

export interface OcrProgress {
  status: string;
  progress: number;
}

const MAX_EDGE = 2200;

let workerPromise: Promise<Worker> | null = null;

/** SIMD is available in every current browser; keep a non-SIMD file for old WebViews. */
function hasSimd(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]),
    );
  } catch {
    return false;
  }
}

function assets(path: string): string {
  return new URL(path, document.baseURI).href;
}

/** Resize and flatten the photo so Tesseract sees a clean, upright page. */
async function prepareImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  // Receipts are mostly black on white; flattening colour helps phone photos.
  context.filter = 'grayscale(1) contrast(1.12)';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ?? file;
}

async function getWorker(onProgress: (progress: OcrProgress) => void): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    const core = hasSimd()
      ? 'ocr/core/tesseract-core-simd-lstm.wasm.js'
      : 'ocr/core/tesseract-core-lstm.wasm.js';

    return createWorker('ind+eng', OEM.LSTM_ONLY, {
      workerPath: assets('ocr/worker.min.js'),
      corePath: assets(core),
      langPath: assets('ocr/lang'),
      // Android's asset packager expands .gz assets; ship plain traineddata.
      gzip: false,
      logger: (message) => {
        onProgress({
          status: message.status,
          progress: Number(message.progress) || 0,
        });
      },
      errorHandler: (error) => {
        console.error('OCR worker error', error);
      },
    });
  })().catch((error) => {
    // A failed load must be retried on the next scan, not cached forever.
    workerPromise = null;
    throw error;
  });

  return workerPromise;
}

/**
 * Turn a photo into plain text. Everything runs locally in a Web Worker;
 * the image never leaves the device.
 */
export async function recogniseReceipt(file: Blob, onProgress: (progress: OcrProgress) => void): Promise<string> {
  const worker = await getWorker(onProgress);
  const image = await prepareImage(file);
  const result = await worker.recognize(image);
  return result.data.text.replace(/\r/g, '\n').trim();
}

/** Stop the cached worker (used when the page is unloaded). */
export async function disposeOcr(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    /* already gone */
  }
}
