import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";

import { intervalLabel, type ProviderResult } from "@/lib/provider-profile";

/**
 * full screen before and after viewer. the split slider is the honest way to
 * show a pair: same frame, same crop, patient drags the divider themselves.
 * no filters, no morphing, no simulated outcome.
 */
export function ResultViewer({
  results,
  index,
  onIndex,
  onClose,
  nameFor,
  providerFirstName,
  providerId,
  storefrontId,
}: {
  results: ProviderResult[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  nameFor: (slug: string) => string;
  providerFirstName: string;
  providerId: string;
  storefrontId: string | undefined;
}) {
  const result = results[index];
  const [split, setSplit] = useState(50);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSplit(50);
  }, [index]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!result) return null;

  const drag = (clientX: number) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return;
    const pct = ((clientX - box.left) / box.width) * 100;
    setSplit(Math.min(100, Math.max(0, pct)));
  };

  const treatment = nameFor(result.treatment_slug);
  const meta = [
    treatment,
    intervalLabel(result.interval_weeks),
    result.sessions && result.sessions > 1 ? `${result.sessions} sessions` : "",
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink text-cream flex flex-col"
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const t = e.changedTouches[0];
        touch.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dy) > 70 && dy > Math.abs(dx)) {
          onClose();
          return;
        }
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          const next = dx < 0 ? index + 1 : index - 1;
          if (next >= 0 && next < results.length) onIndex(next);
        }
      }}
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[11px] lowercase opacity-70">
          {index + 1} of {results.length}
        </span>
        <button type="button" onClick={onClose} aria-label="close" className="p-1">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4">
        <div
          ref={frameRef}
          className="relative w-full aspect-square overflow-hidden rounded-2xl select-none touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) drag(e.clientX);
          }}
        >
          <img
            src={result.after_url}
            alt={`${treatment} after`}
            className="absolute inset-0 size-full object-cover"
          />
          <img
            src={result.before_url}
            alt={`${treatment} before`}
            className="absolute inset-0 size-full object-cover"
            style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          />
          <div
            className="absolute inset-y-0 w-[2px] bg-cream"
            style={{ left: `${split}%` }}
          >
            <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0 size-8 rounded-full bg-cream" />
          </div>
          <span className="absolute bottom-2 left-2 rounded-pill bg-ink/70 px-2 py-0.5 text-[10px] lowercase">
            before
          </span>
          <span className="absolute bottom-2 right-2 rounded-pill bg-ink/70 px-2 py-0.5 text-[10px] lowercase">
            after
          </span>
        </div>

        <p className="mt-4 text-[14px] lowercase">{meta.join(" · ")}</p>
        {result.caption && (
          <p className="mt-1 text-[13px] lowercase opacity-75 leading-relaxed">{result.caption}</p>
        )}
        {result.product_used && (
          <p className="mt-1 text-[12px] lowercase opacity-60">
            product used: {result.product_used.toLowerCase()}
          </p>
        )}
        <p className="mt-2 text-[11px] lowercase opacity-50">
          matched lighting and angle. no filters. interval stated.
        </p>
      </div>

      <div className="px-4 pb-6 pt-3">
        <Link
          to="/book/consult"
          search={{ providerId, storefrontId }}
          className="flex items-center justify-center rounded-pill bg-hot text-cream py-3.5 text-[14px] font-semibold lowercase"
        >
          book this with {providerFirstName}
        </Link>
      </div>
    </div>
  );
}
