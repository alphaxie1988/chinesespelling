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
  | { kind: 'processing'; previewUrl: string }
  | { kind: 'review'; lines: string[] }
  | { kind: 'error'; message: string; previewUrl: string };

// Starts as the whole photo selected, so trimming margins is just dragging
// the handles inward rather than drawing a selection from scratch.
const FULL_CROP: Crop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

// A crop drawn tight against the text (no margin) can make the OCR engine's
// text-detection step throw — its edge-finding internals expect a bit of
// background around a text region, and choke when that region touches the
// crop's border. Growing the selection by a small margin before scanning
// costs nothing visually (the extra sliver is just more of the original
// photo) and avoids that failure mode in the common case.
function padCrop(crop: PixelCrop, image: HTMLImageElement): PixelCrop {
  const marginX = Math.max(8, crop.width * 0.06);
  const marginY = Math.max(8, crop.height * 0.06);
  const x = Math.max(0, crop.x - marginX);
  const y = Math.max(0, crop.y - marginY);
  return {
    unit: 'px',
    x,
    y,
    width: Math.min(image.width, crop.x + crop.width + marginX) - x,
    height: Math.min(image.height, crop.y + crop.height + marginY) - y,
  };
}

const WHITE_BORDER_PX = 32;

// padCrop only helps when there's more of the *original photo* left to
// expand into — if the photo itself is basically just the text edge-to-edge
// (or the crop already covers nearly all of it), there's nothing more to
// grow into and the underlying edge-touching failure can still happen. This
// guarantees real blank margin regardless of the source photo, by drawing
// the (possibly already-padded) image onto a larger white canvas.
function addWhiteBorder(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth + WHITE_BORDER_PX * 2;
      canvas.height = img.naturalHeight + WHITE_BORDER_PX * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, WHITE_BORDER_PX, WHITE_BORDER_PX);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for bordering'));
    img.src = imageUrl;
  });
}

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

  // previewUrl is shown throughout processing/error so the user can see
  // exactly what image was actually sent for scanning (handy for figuring
  // out why a scan failed, or whether a crop came out as expected). It's
  // deliberately *not* revoked on failure — only once we're done needing it
  // (a successful scan, or the user dismissing the error/overlay) — unlike
  // a plain "revoke when this OCR call finishes" approach, which would pull
  // the image out from under the error view right as it appears.
  async function runOcr(imageUrl: string, previewUrl: string) {
    setStep({ kind: 'processing', previewUrl });
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
          previewUrl,
        });
        return;
      }
      URL.revokeObjectURL(previewUrl);
      setStep({ kind: 'review', lines: scanned.map((l) => l.text) });
    } catch (err) {
      // The OCR engine's text-detection step can throw on a tightly-cropped
      // selection (an internal contour-processing edge case when detected
      // text sits flush against the crop's border) — its error messages are
      // raw internals (e.g. array/index errors) that would be confusing
      // shown verbatim, so always surface a friendly, actionable message
      // instead and keep the technical detail in the console for debugging.
      console.error('OCR failed:', err);
      setStep({
        kind: 'error',
        message: "Couldn't read that photo. Try a looser crop (leave a little margin around the text), or use the whole photo instead.",
        previewUrl,
      });
    }
  }

  function handleUseFullPhoto() {
    if (step.kind !== 'cropping') return;
    const url = step.imageUrl;
    // Switches away from the cropping view immediately, before any async
    // work — otherwise a second tap while OCR is still starting up re-enters
    // this handler (step is still 'cropping' from its perspective) and runs
    // a second overlapping scan, which is what was actually causing the
    // "keeps tapping / spinner hangs" reports.
    setStep({ kind: 'processing', previewUrl: url });
    void (async () => {
      const bordered = await addWhiteBorder(url);
      URL.revokeObjectURL(url);
      await runOcr(bordered, bordered);
    })();
  }

  async function handleConfirmCrop() {
    if (step.kind !== 'cropping' || !imgRef.current) return;
    const original = step.imageUrl;

    // No real selection (e.g. they never touched the handles) — just use
    // the whole photo rather than producing a degenerate zero-size crop.
    if (!completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      setStep({ kind: 'processing', previewUrl: original });
      const bordered = await addWhiteBorder(original);
      URL.revokeObjectURL(original);
      await runOcr(bordered, bordered);
      return;
    }

    // Same immediate lock as handleUseFullPhoto, before the (also async)
    // cropToImg step — see comment there.
    setStep({ kind: 'processing', previewUrl: original });
    const croppedUrl = await cropToImg(imgRef.current, padCrop(completedCrop, imgRef.current));
    URL.revokeObjectURL(original);
    const bordered = await addWhiteBorder(croppedUrl);
    await runOcr(bordered, bordered);
  }

  function closeOverlay() {
    if (step.kind === 'cropping') URL.revokeObjectURL(step.imageUrl);
    if (step.kind === 'processing' || step.kind === 'error') URL.revokeObjectURL(step.previewUrl);
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
              <img src={step.previewUrl} alt="Photo being scanned" className="ocr-preview-img" />
              <Loader2 className="spin" size={40} aria-hidden="true" />
              <p>Reading your photo…</p>
            </div>
          )}

          {step.kind === 'error' && (
            <div className="ocr-status">
              <img src={step.previewUrl} alt="Photo that was scanned" className="ocr-preview-img" />
              <p className="error-state">{step.message}</p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  URL.revokeObjectURL(step.previewUrl);
                  setStep({ kind: 'idle' });
                }}
              >
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
