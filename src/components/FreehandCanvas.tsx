import { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';

interface FreehandCanvasProps {
  char: string;
}

// Matches --hanzi-font's stack — canvas text can't reference a CSS variable.
const GUIDE_FONT_STACK = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Heiti SC", sans-serif';

/**
 * A plain freehand scratch-pad — no stroke validation, no grading. Just a
 * faint character guide the student can trace or doodle over with a finger
 * while they think, purely for fun/kinesthetic reinforcement.
 */
export function FreehandCanvas({ char }: FreehandCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  function drawGuide() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx || width === 0 || height === 0) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(128, 128, 128, 0.2)';
    ctx.font = `${height * 0.72}px ${GUIDE_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, width / 2, height / 2 + height * 0.03);
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
    drawGuide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function strokeColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() || '#4353c7';
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;
    const point = getPoint(e);
    ctx.strokeStyle = strokeColor();
    ctx.lineWidth = 6;
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
        className="recall-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <button type="button" className="btn btn-ghost recall-canvas-clear" onClick={drawGuide}>
        <Eraser size={16} aria-hidden="true" /> Clear
      </button>
    </div>
  );
}
