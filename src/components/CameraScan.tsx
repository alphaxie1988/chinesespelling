import { useRef, useState } from 'react';
import { Camera, Check, Image as ImageIcon, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import ReactCrop, { cropToImg, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface CameraScanProps {
  onConfirm: (lines: string[]) => void;
}

type Step =
  | { kind: 'idle' }
  | { kind: 'cropping'; imageUrl: string }
  | { kind: 'processing' }
  | { kind: 'review'; lines: string[] }
  | { kind: 'error'; message: string };

// Starts as the whole photo selected, so trimming margins is just dragging
// the handles inward rather than drawing a selection from scratch.
const FULL_CROP: Crop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

export function CameraScan({ onConfirm }: CameraScanProps) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function handleOpenCamera() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    const url = URL.createObjectURL(file);
    setCrop(FULL_CROP);
    setCompletedCrop(undefined);
    setStep({ kind: 'cropping', imageUrl: url });
  }

  async function runOcr(imageUrl: string) {
    setStep({ kind: 'processing' });
    try {
      // onnxruntime-web + the OCR models are several MB — dynamically
      // imported here so they're only ever fetched once someone actually
      // gets to this point, not merely because Reader rendered this button.
      const { scanImageForChineseLines } = await import('../lib/ocr');
      const scanned = await scanImageForChineseLines(imageUrl);
      if (scanned.length === 0) {
        setStep({
          kind: 'error',
          message: "Couldn't find any Chinese text in that photo. Try a clearer, well-lit shot.",
        });
        return;
      }
      setStep({ kind: 'review', lines: scanned.map((l) => l.text) });
    } catch (err) {
      setStep({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong reading that photo.',
      });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  function handleUseFullPhoto() {
    if (step.kind !== 'cropping') return;
    void runOcr(step.imageUrl);
  }

  async function handleConfirmCrop() {
    if (step.kind !== 'cropping' || !imgRef.current) return;
    const original = step.imageUrl;

    // No real selection (e.g. they never touched the handles) — just use
    // the whole photo rather than producing a degenerate zero-size crop.
    if (!completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      await runOcr(original);
      return;
    }

    const croppedUrl = await cropToImg(imgRef.current, completedCrop);
    URL.revokeObjectURL(original);
    await runOcr(croppedUrl);
  }

  function closeOverlay() {
    if (step.kind === 'cropping') URL.revokeObjectURL(step.imageUrl);
    setStep({ kind: 'idle' });
  }

  function updateLine(index: number, value: string) {
    setStep((s) => (s.kind === 'review' ? { ...s, lines: s.lines.map((l, i) => (i === index ? value : l)) } : s));
  }

  function removeLine(index: number) {
    setStep((s) => (s.kind === 'review' ? { ...s, lines: s.lines.filter((_, i) => i !== index) } : s));
  }

  function addLine() {
    setStep((s) => (s.kind === 'review' ? { ...s, lines: [...s.lines, ''] } : s));
  }

  function handleConfirm() {
    if (step.kind !== 'review') return;
    const cleaned = step.lines.map((l) => l.trim()).filter(Boolean);
    onConfirm(cleaned);
    setStep({ kind: 'idle' });
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="visually-hidden"
      />
      <button type="button" className="btn btn-ghost" onClick={handleOpenCamera}>
        <Camera size={18} aria-hidden="true" /> Scan a list
      </button>

      {step.kind !== 'idle' && (
        <div className="ocr-overlay">
          <button type="button" className="icon-btn ocr-overlay-close" onClick={closeOverlay} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>

          {step.kind === 'cropping' && (
            <div className="ocr-crop">
              <h2>Crop the photo (optional)</h2>
              <p className="hint-text">Drag the corners to trim just the list, or use the whole photo.</p>

              <div className="ocr-crop-area">
                <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={setCompletedCrop}>
                  <img ref={imgRef} src={step.imageUrl} alt="Photo to crop" />
                </ReactCrop>
              </div>

              <div className="test-summary-actions">
                <button type="button" className="btn btn-ghost" onClick={handleUseFullPhoto}>
                  <ImageIcon size={18} aria-hidden="true" /> Use whole photo
                </button>
                <button type="button" className="btn btn-primary" onClick={() => void handleConfirmCrop()}>
                  <Check size={18} aria-hidden="true" /> Crop &amp; scan
                </button>
              </div>
            </div>
          )}

          {step.kind === 'processing' && (
            <div className="ocr-status">
              <Loader2 className="spin" size={40} aria-hidden="true" />
              <p>Reading your photo…</p>
            </div>
          )}

          {step.kind === 'error' && (
            <div className="ocr-status">
              <p className="error-state">{step.message}</p>
              <button type="button" className="btn btn-ghost" onClick={() => setStep({ kind: 'idle' })}>
                <RotateCcw size={18} aria-hidden="true" /> Try again
              </button>
            </div>
          )}

          {step.kind === 'review' && (
            <div className="ocr-review">
              <h2>Review what we found</h2>
              <p className="hint-text">Fix any mistakes, remove lines you don't want, or add a missed one.</p>

              <ul className="ocr-line-list">
                {step.lines.map((line, i) => (
                  <li key={i} className="ocr-line-row">
                    <input className="ocr-line-input" value={line} onChange={(e) => updateLine(i, e.target.value)} />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeLine(i)}
                      aria-label="Remove this line"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <button type="button" className="btn btn-ghost" onClick={addLine}>
                <Plus size={18} aria-hidden="true" /> Add a line
              </button>

              <div className="test-summary-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setStep({ kind: 'idle' })}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={step.lines.every((l) => !l.trim())}
                >
                  Use these words
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
