import { useRef, useState } from 'react';
import { Camera, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react';

interface CameraScanProps {
  onConfirm: (lines: string[]) => void;
}

type Step =
  | { kind: 'idle' }
  | { kind: 'processing' }
  | { kind: 'review'; lines: string[] }
  | { kind: 'error'; message: string };

export function CameraScan({ onConfirm }: CameraScanProps) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenCamera() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    const url = URL.createObjectURL(file);
    setStep({ kind: 'processing' });
    try {
      // onnxruntime-web + the OCR models are several MB — dynamically
      // imported here so they're only ever fetched once someone actually
      // selects a photo, not merely because Reader rendered this button.
      const { scanImageForChineseLines } = await import('../lib/ocr');
      const scanned = await scanImageForChineseLines(url);
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
      URL.revokeObjectURL(url);
    }
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
          <button
            type="button"
            className="icon-btn ocr-overlay-close"
            onClick={() => setStep({ kind: 'idle' })}
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>

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
