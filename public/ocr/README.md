# Bundled OCR runtime

These files make receipt scanning work offline, with no CDN request.

- `worker.min.js` — [Tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0, Apache-2.0.
- `core/` — [tesseract.js-core](https://github.com/naptha/tesseract.js-core) LSTM WebAssembly builds, Apache-2.0.
- `lang/ind.traineddata`, `lang/eng.traineddata` — Indonesian and English `tessdata_fast` data from
  [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast), Apache-2.0.

Copied from the npm packages during development; see the license files in this
folder. The app only loads them when someone opens the receipt scanner.
