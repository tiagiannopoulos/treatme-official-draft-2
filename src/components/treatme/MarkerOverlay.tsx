import type { ReactElement } from "react";
import { useId, useMemo } from "react";

import type { MarkedRegion } from "@/lib/skinAnalysis";

/**
 * the patient photo overlay. coordinates come back as fractions of the image,
 * so the svg uses a 0 0 1 1 viewBox and the numbers map straight through.
 *
 * every indicator draws in its own visual language, the same vocabulary as the
 * stylised diagram: blooms for redness, patches for pigmentation, speckle for
 * pores and oiliness, hatch for texture, crescents under the eyes, dashed
 * contours for firmness and volume loss, an axis for symmetry.
 *
 * be honest about precision: a read lands in the right area, not on the exact
 * pore, so everything stays soft and translucent. never a hard tight ring.
 */

/**
 * a few accents in the table are almost white, which reads as fog on a photo
 * rather than a marking. deepen the very light ones so every indicator stays
 * legible on skin while keeping its hue.
 */
function photoAccent(accent: string): string {
  const hex = accent.replace("#", "");
  if (hex.length !== 6) return accent;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (l < 0.78) return accent;

  // keep the hue, deepen and enrich it so the marking reads on skin
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const sat = Math.max(d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), 0.34);
  const lig = 0.62;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]!;
  return (
    "#" +
    rgb
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hasMarkers(regions: MarkedRegion[] | null | undefined): boolean {
  return Boolean(regions && regions.length > 0);
}

/** at thumbnail size more than ten markers reads as mud */
export function strongest(regions: MarkedRegion[], limit: number): MarkedRegion[] {
  return [...regions].sort((a, b) => b.intensity - a.intensity).slice(0, limit);
}

/** deterministic jitter so a mark looks hand placed but never moves between renders */
function wobble(seed: number, salt: number): number {
  const v = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

type Draw = (m: MarkedRegion, i: number, accent: string) => ReactElement | null;

/** soft filled blob, optionally stretched, used by blooms, clouds and patches */
function blob(m: MarkedRegion, i: number, accent: string, spread: number, alpha: number) {
  const r = Math.max(0.02, m.r * spread);
  const rx = r * (0.85 + wobble(i, 1) * 0.5);
  const ry = r * (0.8 + wobble(i, 2) * 0.55);
  return (
    <ellipse
      key={i}
      cx={m.x}
      cy={m.y}
      rx={rx}
      ry={ry}
      fill={accent}
      opacity={Math.min(0.85, alpha + m.intensity * 0.3)}
      transform={`rotate(${wobble(i, 3) * 180 - 90} ${m.x} ${m.y})`}
    />
  );
}

/**
 * speckle, used by pores and oiliness. each measured tile scatters a handful of
 * small dots inside its radius so a cluster reads as skin texture rather than
 * one flat disc.
 */
function speck(m: MarkedRegion, i: number, accent: string, scale: number, count: number) {
  const r = Math.max(0.0035, m.r * scale);
  const opacity = Math.min(0.9, 0.45 + m.intensity * 0.45);
  return (
    <g key={i} fill={accent} opacity={opacity}>
      {Array.from({ length: count }, (_, k) => {
        const ang = wobble(i, k + 10) * Math.PI * 2;
        const dist = wobble(i, k + 30) * m.r * 0.9;
        return (
          <circle
            key={k}
            cx={m.x + Math.cos(ang) * dist}
            cy={m.y + Math.sin(ang) * dist}
            r={r * (0.7 + wobble(i, k + 50) * 0.6)}
          />
        );
      })}
    </g>
  );
}


/** a short curved stroke through the mark, angle varied per mark */
function stroke(
  m: MarkedRegion,
  i: number,
  accent: string,
  opts: { len: number; weight: number; bow: number; angle?: number; dash?: string },
) {
  const half = Math.max(0.012, m.r * opts.len);
  const angle = opts.angle ?? wobble(i, 4) * 120 - 60;
  const d = `M ${m.x - half} ${m.y} Q ${m.x} ${m.y + half * opts.bow} ${m.x + half} ${m.y}`;
  return (
    <path
      key={i}
      d={d}
      fill="none"
      stroke={accent}
      strokeWidth={Math.max(0.004, m.r * opts.weight)}
      strokeLinecap="round"
      strokeDasharray={opts.dash}
      opacity={Math.min(0.9, 0.5 + m.intensity * 0.4)}
      transform={`rotate(${angle} ${m.x} ${m.y})`}
    />
  );
}

/** a filled crescent sitting under the mark, used by the under eye reads */
function crescent(m: MarkedRegion, i: number, accent: string, thickness: number) {
  const w = Math.max(0.02, m.r * 2.2);
  const t = w * thickness;
  const d =
    `M ${m.x - w} ${m.y - t * 0.3} Q ${m.x} ${m.y + t * 1.6} ${m.x + w} ${m.y - t * 0.3}` +
    ` Q ${m.x} ${m.y + t * 0.5} ${m.x - w} ${m.y - t * 0.3} Z`;
  return (
    <path
      key={i}
      d={d}
      fill={accent}
      opacity={Math.min(0.9, 0.5 + m.intensity * 0.4)}
    />
  );
}

/** dashed ring with no hard edge, used by volume loss */
function deflate(m: MarkedRegion, i: number, accent: string) {
  const r = Math.max(0.03, m.r * 1.2);
  return (
    <g key={i} opacity={Math.min(0.85, 0.45 + m.intensity * 0.35)}>
      <circle cx={m.x} cy={m.y} r={r} fill={accent} opacity={0.18} />
      <circle
        cx={m.x}
        cy={m.y}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={0.004}
        strokeDasharray="0.012 0.012"
      />
    </g>
  );
}

function drawerFor(kind: string): { draw: Draw; blur: number } {
  switch (kind) {
    case "bloom":
      return { draw: (m, i, a) => blob(m, i, a, 1.9, 0.3), blur: 0.02 };
    case "cloud":
      return { draw: (m, i, a) => blob(m, i, a, 1.8, 0.13), blur: 0.026 };
    case "patches":
      return { draw: (m, i, a) => blob(m, i, a, 1.35, 0.35), blur: 0.012 };
    case "patches_soft":
      return { draw: (m, i, a) => blob(m, i, a, 1.7, 0.26), blur: 0.022 };
    case "dots_dense":
      return { draw: (m, i, a) => speck(m, i, a, 0.28, 7), blur: 0.0015 };
    case "dots_scatter":
      return { draw: (m, i, a) => speck(m, i, a, 0.32, 5), blur: 0.002 };
    case "spots":
      return {
        draw: (m, i, a) => {
          const r = Math.max(0.008, m.r * 0.8);
          return (
            <g key={i} opacity={Math.min(0.9, 0.5 + m.intensity * 0.4)}>
              <circle cx={m.x} cy={m.y} r={r * 1.9} fill={a} opacity={0.22} />
              <circle cx={m.x} cy={m.y} r={r} fill={a} opacity={0.55} />
            </g>
          );
        },
        blur: 0.004,
      };
    case "hatch":
      return {
        draw: (m, i, a) => stroke(m, i, a, { len: 0.85, weight: 0.4, bow: 1.7 }),
        blur: 0.003,
      };
    case "strokes_long":
      return {
        draw: (m, i, a) =>
          stroke(m, i, a, { len: 1.4, weight: 0.1, bow: 0.6, angle: wobble(i, 5) * 12 - 6 }),
        blur: 0.003,
      };
    case "strokes_short":
      return {
        draw: (m, i, a) =>
          stroke(m, i, a, { len: 0.9, weight: 0.1, bow: 0.7, angle: wobble(i, 6) * 60 - 30 }),
        blur: 0.002,
      };
    case "crescent":
      return { draw: (m, i, a) => crescent(m, i, a, 0.62), blur: 0.005 };
    case "crescent_soft":
      return { draw: (m, i, a) => crescent(m, i, a, 0.6), blur: 0.01 };
    case "crescent_thin":
      return {
        draw: (m, i, a) => stroke(m, i, a, { len: 2, weight: 0.12, bow: 1.1, angle: 0 }),
        blur: 0.004,
      };
    case "arc_upper":
      return {
        draw: (m, i, a) => stroke(m, i, a, { len: 2, weight: 0.16, bow: -1.2, angle: 0 }),
        blur: 0.005,
      };
    case "contour":
      return {
        draw: (m, i, a) =>
          stroke(m, i, a, {
            len: 1.8,
            weight: 0.09,
            bow: 0.9,
            angle: 0,
            dash: "0.014 0.012",
          }),
        blur: 0.004,
      };
    case "deflate":
      return { draw: deflate, blur: 0.006 };
    case "axis":
      return {
        draw: (m, i, a) => blob(m, i, a, 1.3, 0.3),
        blur: 0.016,
      };
    default:
      return { draw: (m, i, a) => blob(m, i, a, 1.4, 0.32), blur: 0.014 };
  }
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

  const { draw, blur } = drawerFor(overlayKind);
  const ink = photoAccent(accent);
  const axis = overlayKind === "axis";
  const mid = axis ? marks.reduce((sum, m) => sum + m.x, 0) / marks.length : 0.5;

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
      {axis ? (
        // symmetry reads as the midline it is measured against
        <g stroke={ink} strokeWidth={0.003} strokeDasharray="0.02 0.016" opacity={0.5}>
          <line x1={mid} y1={0.08} x2={mid} y2={0.95} />
          <line x1={0.08} y1={0.38} x2={0.92} y2={0.38} />
          <line x1={0.08} y1={0.62} x2={0.92} y2={0.62} />
        </g>
      ) : null}
      <g filter={`url(#soft-${id})`}>{marks.map((m, i) => draw(m, i, ink))}</g>
    </svg>
  );
}
