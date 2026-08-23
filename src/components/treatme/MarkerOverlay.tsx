import { useId, useMemo } from "react";

import type { MarkedRegion } from "@/lib/skinAnalysis";

/**
 * the patient photo overlay. coordinates come back from the vision read as
 * fractions of the image, so the svg uses a 0 0 1 1 viewBox and the numbers
 * map straight through with no maths.
 *
 * be honest about precision: these land in the right area, not on the exact
 * pore, so everything is soft, blurred and translucent. never a tight ring.
 */

const LINE_KINDS = new Set([
  "strokes_long",
  "strokes_short",
  "contour",
  "axis",
  "crescent",
  "crescent_soft",
  "crescent_thin",
  "arc_upper",
  "deflate",
]);

export function hasMarkers(regions: MarkedRegion[] | null | undefined): boolean {
  return Boolean(regions && regions.length > 0);
}

/** at thumbnail size more than ten markers reads as mud */
export function strongest(regions: MarkedRegion[], limit: number): MarkedRegion[] {
  return [...regions].sort((a, b) => b.intensity - a.intensity).slice(0, limit);
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
  const marks = useMemo(
    () => (limit ? strongest(regions, limit) : regions.slice(0, 40)),
    [regions, limit],
  );

  if (!marks.length) return null;

  const isLine = LINE_KINDS.has(overlayKind);
  const blur = isLine ? 0.006 : 0.012;

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
      <g filter={`url(#soft-${id})`}>
        {marks.map((m, i) => {
          const opacity = Math.min(0.9, 0.35 + m.intensity * 0.45);
          if (isLine) {
            // a soft stroke through the marked place rather than a filled blob
            const half = Math.max(0.012, m.r);
            const arc = overlayKind.startsWith("crescent") || overlayKind === "arc_upper";
            const dip = arc ? half * 0.55 : 0;
            const d = `M ${m.x - half} ${m.y} Q ${m.x} ${m.y + dip} ${m.x + half} ${m.y}`;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={accent}
                strokeWidth={Math.max(0.006, m.r * 0.35)}
                strokeLinecap="round"
                opacity={opacity}
              />
            );
          }
          return (
            <circle
              key={i}
              cx={m.x}
              cy={m.y}
              r={Math.max(0.012, m.r)}
              fill={accent}
              opacity={opacity}
            />
          );
        })}
      </g>
    </svg>
  );
}
