import type { MarkedRegion } from "@/lib/skinAnalysis";

/**
 * THE one place marker geometry is decided. both the app overlay and the pdf
 * report render from this, so a person sees the same markings on screen and in
 * the file they download.
 *
 * everything is normalised 0..1 against the photo, so a renderer only needs a
 * "0 0 1 1" viewbox and no maths of its own. shapes are emitted as plain paths,
 * circles and lines: primitives both svg and @react-pdf/renderer understand.
 */

export interface ShapePath {
  kind: "path";
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  opacity: number;
}

export interface ShapeCircle {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity: number;
}

export interface ShapeLine {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  dash?: string;
  opacity: number;
}

export type MarkerShape = ShapePath | ShapeCircle | ShapeLine;

export interface MarkerDrawing {
  /** every shape, in paint order */
  shapes: MarkerShape[];
  /** how soft the edges should be, in the same normalised units */
  blur: number;
}

export function hasMarkers(regions: MarkedRegion[] | null | undefined): boolean {
  return Boolean(regions && regions.length > 0);
}

/** at thumbnail size more than ten markers reads as mud */
export function strongest(regions: MarkedRegion[], limit: number): MarkedRegion[] {
  return [...regions].sort((a, b) => b.intensity - a.intensity).slice(0, limit);
}

/** deterministic jitter so a mark looks hand placed but never moves between renders */
export function wobble(seed: number, salt: number): number {
  const v = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * a few accents in the table are almost white, which reads as fog on a photo
 * rather than a marking. deepen the very light ones so every indicator stays
 * legible on skin while keeping its hue.
 */
export function photoAccent(accent: string): string {
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
  const rgbTriple = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]!;
  return (
    "#" +
    rgbTriple.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** a rotated ellipse written as two arcs, so no renderer needs transform support */
function ellipsePath(cx: number, cy: number, rx: number, ry: number, deg: number): string {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.cos(rad) * rx;
  const dy = Math.sin(rad) * rx;
  const x1 = round(cx - dx);
  const y1 = round(cy - dy);
  const x2 = round(cx + dx);
  const y2 = round(cy + dy);
  const a = `${round(rx)} ${round(ry)} ${round(deg)}`;
  return `M ${x1} ${y1} A ${a} 0 1 ${x2} ${y2} A ${a} 0 1 ${x1} ${y1} Z`;
}

/** a curved stroke through the mark, rotation baked into the point maths */
function strokePath(
  m: MarkedRegion,
  half: number,
  bow: number,
  deg: number,
): string {
  const rad = (deg * Math.PI) / 180;
  const rot = (px: number, py: number): [number, number] => {
    const ox = px - m.x;
    const oy = py - m.y;
    return [
      round(m.x + ox * Math.cos(rad) - oy * Math.sin(rad)),
      round(m.y + ox * Math.sin(rad) + oy * Math.cos(rad)),
    ];
  };
  const [sx, sy] = rot(m.x - half, m.y);
  const [qx, qy] = rot(m.x, m.y + half * bow);
  const [ex, ey] = rot(m.x + half, m.y);
  return `M ${sx} ${sy} Q ${qx} ${qy} ${ex} ${ey}`;
}

/** soft filled blob, used by blooms, clouds and patches */
function blob(m: MarkedRegion, i: number, accent: string, spread: number, alpha: number): MarkerShape {
  const r = Math.max(0.02, m.r * spread);
  const rx = r * (0.85 + wobble(i, 1) * 0.5);
  const ry = r * (0.8 + wobble(i, 2) * 0.55);
  return {
    kind: "path",
    d: ellipsePath(m.x, m.y, rx, ry, wobble(i, 3) * 180 - 90),
    fill: accent,
    opacity: Math.min(0.85, alpha + m.intensity * 0.3),
  };
}

/** speckle, used by pores and oiliness: a handful of small dots per measured tile */
function speck(
  m: MarkedRegion,
  i: number,
  accent: string,
  scale: number,
  count: number,
): MarkerShape[] {
  const r = Math.max(0.0035, m.r * scale);
  const opacity = Math.min(0.9, 0.45 + m.intensity * 0.45);
  return Array.from({ length: count }, (_, k): MarkerShape => {
    const ang = wobble(i, k + 10) * Math.PI * 2;
    const dist = wobble(i, k + 30) * m.r * 0.9;
    return {
      kind: "circle",
      cx: round(m.x + Math.cos(ang) * dist),
      cy: round(m.y + Math.sin(ang) * dist),
      r: round(r * (0.7 + wobble(i, k + 50) * 0.6)),
      fill: accent,
      opacity,
    };
  });
}

function stroke(
  m: MarkedRegion,
  i: number,
  accent: string,
  opts: { len: number; weight: number; bow: number; angle?: number; dash?: string },
): MarkerShape {
  const half = Math.max(0.012, m.r * opts.len);
  const angle = opts.angle ?? wobble(i, 4) * 120 - 60;
  return {
    kind: "path",
    d: strokePath(m, half, opts.bow, angle),
    stroke: accent,
    strokeWidth: Math.max(0.004, m.r * opts.weight),
    dash: opts.dash,
    opacity: Math.min(0.9, 0.5 + m.intensity * 0.4),
  };
}

/** a filled crescent sitting under the mark, used by the under eye reads */
function crescent(m: MarkedRegion, accent: string, thickness: number): MarkerShape {
  const w = Math.max(0.02, m.r * 2.2);
  const t = w * thickness;
  const d =
    `M ${round(m.x - w)} ${round(m.y - t * 0.3)} Q ${round(m.x)} ${round(m.y + t * 1.6)} ${round(m.x + w)} ${round(m.y - t * 0.3)}` +
    ` Q ${round(m.x)} ${round(m.y + t * 0.5)} ${round(m.x - w)} ${round(m.y - t * 0.3)} Z`;
  return {
    kind: "path",
    d,
    fill: accent,
    opacity: Math.min(0.9, 0.5 + m.intensity * 0.4),
  };
}

/** soft disc plus a dashed edge, used by volume loss */
function deflate(m: MarkedRegion, accent: string): MarkerShape[] {
  const r = Math.max(0.03, m.r * 1.2);
  const outer = Math.min(0.85, 0.45 + m.intensity * 0.35);
  return [
    { kind: "circle", cx: m.x, cy: m.y, r, fill: accent, opacity: outer * 0.18 },
    {
      kind: "path",
      d: ellipsePath(m.x, m.y, r, r, 0),
      stroke: accent,
      strokeWidth: 0.004,
      dash: "0.012 0.012",
      opacity: outer,
    },
  ];
}

function spots(m: MarkedRegion, accent: string): MarkerShape[] {
  const r = Math.max(0.008, m.r * 0.8);
  const base = Math.min(0.9, 0.5 + m.intensity * 0.4);
  return [
    { kind: "circle", cx: m.x, cy: m.y, r: r * 1.9, fill: accent, opacity: base * 0.22 },
    { kind: "circle", cx: m.x, cy: m.y, r, fill: accent, opacity: base * 0.55 },
  ];
}

function drawerFor(kind: string): {
  draw: (m: MarkedRegion, i: number, accent: string) => MarkerShape | MarkerShape[];
  blur: number;
} {
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
      return { draw: (m, _i, a) => spots(m, a), blur: 0.004 };
    case "hatch":
      return { draw: (m, i, a) => stroke(m, i, a, { len: 0.85, weight: 0.4, bow: 1.7 }), blur: 0.003 };
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
      return { draw: (m, _i, a) => crescent(m, a, 0.62), blur: 0.005 };
    case "crescent_soft":
      return { draw: (m, _i, a) => crescent(m, a, 0.6), blur: 0.01 };
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
          stroke(m, i, a, { len: 1.8, weight: 0.09, bow: 0.9, angle: 0, dash: "0.014 0.012" }),
        blur: 0.004,
      };
    case "deflate":
      return { draw: (m, _i, a) => deflate(m, a), blur: 0.006 };
    case "axis":
      return { draw: (m, i, a) => blob(m, i, a, 1.3, 0.3), blur: 0.016 };
    default:
      return { draw: (m, i, a) => blob(m, i, a, 1.4, 0.32), blur: 0.014 };
  }
}

/**
 * turns measured regions into the shapes to paint. same input, same output,
 * every time, in the app and in the report.
 */
export function markerDrawing({
  regions,
  accent,
  overlayKind = "patches_soft",
  limit,
}: {
  regions: MarkedRegion[];
  accent: string;
  overlayKind?: string;
  limit?: number;
}): MarkerDrawing {
  const marks = limit ? strongest(regions, limit) : regions.slice(0, 40);
  if (!marks.length) return { shapes: [], blur: 0 };

  const { draw, blur } = drawerFor(overlayKind);
  const ink = photoAccent(accent);
  const shapes: MarkerShape[] = [];

  if (overlayKind === "axis") {
    // symmetry reads as the midline it is measured against
    const mid = marks.reduce((sum, m) => sum + m.x, 0) / marks.length;
    const dash = "0.02 0.016";
    shapes.push(
      { kind: "line", x1: mid, y1: 0.08, x2: mid, y2: 0.95, stroke: ink, strokeWidth: 0.003, dash, opacity: 0.5 },
      { kind: "line", x1: 0.08, y1: 0.38, x2: 0.92, y2: 0.38, stroke: ink, strokeWidth: 0.003, dash, opacity: 0.5 },
      { kind: "line", x1: 0.08, y1: 0.62, x2: 0.92, y2: 0.62, stroke: ink, strokeWidth: 0.003, dash, opacity: 0.5 },
    );
  }

  marks.forEach((m, i) => {
    const out = draw(m, i, ink);
    if (Array.isArray(out)) shapes.push(...out);
    else shapes.push(out);
  });

  return { shapes, blur };
}
