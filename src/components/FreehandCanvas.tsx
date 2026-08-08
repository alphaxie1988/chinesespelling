import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Eraser } from 'lucide-react';

interface FreehandCanvasProps {
  /** Freezes the drawing and hides Clear once the answer is revealed, so
   * the student's attempt stays as-is instead of being editable. */
  readOnly?: boolean;
}

export interface FreehandCanvasHandle {
  /** A snapshot of the current drawing (data URL), or null if there's
   * nothing to snapshot (canvas not mounted). Used to save what the
   * student drew before moving on to the next card. */
  getSnapshot: () => string | null;
}

/**
 * A plain freehand scratch-pad — no stroke validation, no grading, and no
 * character guide (that would give away the answer before it's revealed).
 * Just somewhere to doodle with a finger while thinking, purely for fun.
 */
export const FreehandCanvas = forwardRef<FreehandCanvasHandle, FreehandCanvasProps>(function FreehandCanvas(
  { readOnly = false },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    getSnapshot: () => canvasRef.current?.toDataURL('image/png') ?? null,
  }));

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function strokeColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() || '#4353c7';
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly) return;
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly || !drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;
    const point = getPoint(e);
    ctx.strokeStyle = strokeColor();
    ctx.lineWidth = 4.2; // 70% of the original 6px stroke width
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  return (
    <div className="recall-canvas-wrap">
      <canvas
        ref={canvasRef}
        className={`recall-canvas ${readOnly ? 'recall-canvas-readonly' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {!readOnly && (
        <button type="button" className="recall-canvas-clear" onClick={clearCanvas} aria-label="Clear drawing">
          <Eraser size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});
