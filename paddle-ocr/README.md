# Bundled PaddleOCR runtime

These files make receipt scanning work offline, with no CDN request.

- `det.onnx` — PP-OCRv5 mobile text detector (4.7 MB), from
  [`bent2685/ocr-web`](https://github.com/bent2685/ocr-web) / PaddlePaddle PP-OCRv5.
- `rec.onnx` — PP-OCRv5 mobile Latin text recognizer, statically quantized to INT8 (2.3 MB), from
  [`403323726/PP-OCRv5`](https://github.com/403323726/PP-OCRv5) / PaddlePaddle PP-OCRv5.
- `dict.txt` — the 502-character Latin dictionary that matches `rec.onnx`.
- `ort/ort-wasm-simd-threaded.mjs`, `ort/ort-wasm-simd-threaded.wasm` — ONNX Runtime Web
  WASM backend, MIT-licensed.

The app loads these only when someone opens the receipt scanner. The detector stays
FP32 for reliable box detection; the recognizer is INT8 (2.3 MB) and the pair is 7 MB. PaddleOCR and the
PP-OCRv5 models are Apache-2.0; see `LICENSE-paddleocr.txt`. The `@ocr-web/core` browser
runtime is MIT; see `LICENSE-ocr-web.txt`.
