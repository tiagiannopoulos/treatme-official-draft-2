import { useId, useMemo } from "react";

import { markerDrawing, type MarkerShape } from "@/lib/marker-shapes";
import type { MarkedRegion } from "@/lib/skinAnalysis";

export { hasMarkers, strongest } from "@/lib/marker-shapes";

/**
 * the patient photo overlay. coordinates come back as fractions of the image,
 * so the svg uses a 0 0 1 1 viewBox and the numbers map straight through.
 *
 * the geometry itself lives in lib/marker-shapes so the pdf report draws the
 * exact same markings from the exact same code.
 *
 * be honest about precision: a read lands in the right area, not on the exact
 * pore, so everything stays soft and translucent. never a hard tight ring.
 */

function Shape({ shape, index }: { shape: MarkerShape; index: number }) {
  if (shape.kind === "circle") {
    return (
      <circle
        key={index}
        cx={shape.cx}
        cy={shape.cy}
        r={shape.r}
        fill={shape.fill}
        opacity={shape.opacity}
      />
    );
  }
  if (shape.kind === "line") {
    return (
      <line
        key={index}
        x1={shape.x1}
        y1={shape.y1}
        x2={shape.x2}
        y2={shape.y2}
        stroke={shape.stroke}
        strokeWidth={shape.strokeWidth}
        strokeDasharray={shape.dash}
        opacity={shape.opacity}
      />
    );
  }
  return (
    <path
      key={index}
      d={shape.d}
      fill={shape.fill ?? "none"}
      stroke={shape.stroke}
      strokeWidth={shape.strokeWidth}
      strokeDasharray={shape.dash}
      strokeLinecap="round"
      opacity={shape.opacity}
    />
  );
}

export function MarkerOverlay({
  regions,
  accent,
  overlayKind = "patches_soft",
  limit,
  className = "",
}: {
  regions: MarkedRegion[];
  accent: string;
  overlayKind?: string;
  /** cap the marker count, used by the small thumbnails */
  limit?: number;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { shapes, blur } = useMemo(
    () => markerDrawing({ regions, accent, overlayKind, limit }),
    [regions, accent, overlayKind, limit],
  );

  if (!shapes.length) return null;

  // the dashed axis lines stay crisp, the markings themselves stay soft
  const lines = shapes.filter((s) => s.kind === "line");
  const marks = shapes.filter((s) => s.kind !== "line");

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <filter id={`soft-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={blur} />
        </filter>
      </defs>
      {lines.map((s, i) => (
        <Shape key={`l${i}`} shape={s} index={i} />
      ))}
      <g filter={`url(#soft-${id})`}>
        {marks.map((s, i) => (
          <Shape key={i} shape={s} index={i} />
        ))}
      </g>
    </svg>
  );
}
