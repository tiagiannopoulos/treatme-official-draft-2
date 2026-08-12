import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/** pinch to zoom, drag to pan once zoomed. double tap resets. */
export function PinchZoom({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ dist: number; scale: number } | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTap = useRef(0);

  const clampOffset = (next: { x: number; y: number }, s: number) => {
    const limit = ((s - 1) / 2) * 100;
    return {
      x: Math.max(-limit, Math.min(limit, next.x)),
      y: Math.max(-limit, Math.min(limit, next.y)),
    };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      start.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      pan.current = null;
      return;
    }

    const now = Date.now();
    if (now - lastTap.current < 280) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
    lastTap.current = now;
    if (scale > 1) pan.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && start.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = Math.max(1, Math.min(3.5, (dist / start.current.dist) * start.current.scale));
      setScale(next);
      setOffset((prev) => clampOffset(prev, next));
      return;
    }

    if (pan.current && scale > 1) {
      const dx = ((e.clientX - pan.current.x) / 3) + pan.current.ox;
      const dy = ((e.clientY - pan.current.y) / 3) + pan.current.oy;
      setOffset(clampOffset({ x: dx, y: dy }, scale));
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) start.current = null;
    if (pointers.current.size === 0) pan.current = null;
  };

  return (
    <div
      className={`relative overflow-hidden touch-none ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}%, ${offset.y}%) scale(${scale})`,
          transformOrigin: "center",
          transition: pointers.current.size ? "none" : "transform 160ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
