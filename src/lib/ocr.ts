import { OcrEngine } from '@ocr-web/core';

export interface OcrProgress {
  /** loading = model/WASM download, detecting = text boxes, recognizing = characters */
  status: 'loading' | 'detecting' | 'recognizing';
  progress: number;
}

const MAX_EDGE = 2200;

let enginePromise: Promise<OcrEngine> | null = null;

function assets(path: string): string {
  return new URL(path, document.baseURI).href;
}

/** Resize and flatten the photo before PP-OCR looks for text boxes. */
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
  // Receipts are mostly dark text on a light background; flatten colour noise.
  context.filter = 'grayscale(1) contrast(1.1)';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ?? file;
}

async function getEngine(onProgress: (progress: OcrProgress) => void): Promise<OcrEngine> {
  if (enginePromise) return enginePromise;

  const threads =
    typeof SharedArrayBuffer !== 'undefined' &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated
      ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2))
      : 1;

  onProgress({ status: 'loading', progress: 0.04 });
  enginePromise = OcrEngine.create({
    models: {
      detection: assets('paddle-ocr/det.onnx'),
      recognition: assets('paddle-ocr/rec.onnx'),
    },
    dictionary: assets('paddle-ocr/dict.txt'),
    runtime: 'wasm',
    wasmPaths: assets('paddle-ocr/ort/'),
    // Android WebView and GitHub Pages are not cross-origin isolated, so this
    // stays at 1 there; a local preview with COOP/COEP can use more threads.
    numThreads: threads,
    onProgress: (update) => {
      const ratio = update.total > 0 ? update.loaded / update.total : 0;
      onProgress({ status: 'loading', progress: Math.min(0.62, 0.05 + ratio * 0.57) });
    },
  }).catch((error) => {
    // A failed download must be retried on the next scan.
    enginePromise = null;
    throw error;
  });

  return enginePromise;
}

/**
 * Run PaddleOCR's PP-OCRv5 mobile detection + Latin recognition pipeline
 * locally. The .onnx models and ONNX Runtime WASM ship with the app, so no
 * image or text leaves the device during OCR.
 */
export async function recogniseReceipt(file: Blob, onProgress: (progress: OcrProgress) => void): Promise<string> {
  const engine = await getEngine(onProgress);
  onProgress({ status: 'detecting', progress: 0.7 });

  const image = await prepareImage(file);
  const result = await engine.recognize(image, {
    maxSideLen: MAX_EDGE,
    detThreshold: 0.25,
    detBoxThreshold: 0.5,
    unclipRatio: 1.8,
    minBoxSize: 3,
  });

  onProgress({ status: 'recognizing', progress: 1 });
  return result.fullText.replace(/\r/g, '\n').trim();
}

/** Start loading the models as soon as the scan picker opens. */
export function warmOcr(onProgress: (progress: OcrProgress) => void = () => {}): void {
  void getEngine(onProgress).catch(() => {
    /* the actual scan retries and shows the error */
  });
}

/** Release the ONNX sessions and their WASM memory. */
export async function disposeOcr(): Promise<void> {
  const pending = enginePromise;
  enginePromise = null;
  if (!pending) return;
  try {
    const engine = await pending;
    await engine.dispose();
  } catch {
    /* already gone */
  }
}
