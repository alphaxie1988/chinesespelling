import { env } from 'onnxruntime-web';
import Ocr from '@gutenye/ocr-browser';
import { isChineseChar } from './segment';

// Runs entirely offline in the browser via ONNX Runtime Web — no server,
// no API key, no cost. Detection + recognition models are PP-OCRv4
// (PaddleOCR), bundled as static assets under public/ocr/ (see
// THIRD_PARTY_NOTICES.md). This is a large, rarely-used feature, so the
// engine and its ~16MB of models/WASM runtime are only fetched the first
// time someone actually scans a photo, not on every app visit.

type OcrEngine = Awaited<ReturnType<typeof Ocr.create>>;

let enginePromise: Promise<OcrEngine> | null = null;

function loadEngine(): Promise<OcrEngine> {
  if (!enginePromise) {
    const base = import.meta.env.BASE_URL;
    env.wasm.wasmPaths = `${base}ort/`;
    enginePromise = Ocr.create({
      models: {
        detectionPath: `${base}ocr/ch_PP-OCRv4_det_infer.onnx`,
        recognitionPath: `${base}ocr/ch_PP-OCRv4_rec_infer.onnx`,
        dictionaryPath: `${base}ocr/ppocr_keys_v1.txt`,
      },
    }).catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

export interface ScannedLine {
  id: string;
  /** Only the Chinese characters from this line — English captions, page
   * numbers, and stray punctuation on a real worksheet photo are dropped. */
  text: string;
}

function extractChinese(text: string): string {
  return Array.from(text)
    .filter(isChineseChar)
    .join('');
}

/**
 * Scans a photo (as an object URL, data URL, or any fetchable image URL) and
 * returns the Chinese text found, one entry per detected line, ordered
 * top-to-bottom as it appears in the photo. Lines with no Chinese characters
 * (e.g. an English heading) are dropped.
 */
export async function scanImageForChineseLines(imageUrl: string): Promise<ScannedLine[]> {
  const ocr = await loadEngine();
  const results = await ocr.detect(imageUrl);

  return results
    .map((line, index) => ({
      index,
      top: line.box?.[0]?.[1] ?? 0,
      text: extractChinese(line.text),
    }))
    .filter((line) => line.text.length > 0)
    .sort((a, b) => a.top - b.top)
    .map((line) => ({ id: `${line.index}`, text: line.text }));
}
