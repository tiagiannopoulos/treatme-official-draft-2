import type { MarkedRegion } from "@/lib/skinAnalysis";
import type { Landmark } from "@/lib/facemesh";
import {
  chevronsAlong,
  faceGuides,
  inwardArrow,
  markable,
  polylinePath,
  type FaceGuides,
  type Polyline,
} from "@/lib/marker-paths";

/**
 * THE one place marker geometry is decided. the app overlay, the results
 * thumbnails and the pdf report all render from this, so a person sees the same
 * markings on screen and in the file they download.
 *
 * everything is normalised 0..1 against the photo, so a renderer only needs a
 * "0 0 1 1" viewbox and no maths of its own. shapes are emitted as plain paths,
 * circles and lines: primitives both svg and @react-pdf/renderer understand.
 *
 * the rules that hold for all eighteen indicators:
 *   · every marker is clipped to the detected face, never hair, background,
 *     clothing, eyes, nostrils or lips
 *   · a zone measured at nothing gets no markers at all
 *   · density scales with severity: 90 reads nearly clear, 40 reads clearly marked
 *   · placement is deterministic from the scan id, so a scan renders identically
 *     every time
 *   · soft translucent shapes in the indicator's accent, never a hard outline:
 *     we are showing an area, not claiming a pixel
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
  /** closed path of the detected face. markers are clipped to it. */
  clipPath?: string;
  /** how these positions were arrived at, copied from skin_indicators */
  placementMethod?: string;
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

/** a stable number from the scan id, so model placed marks never move */
export function seedFrom(seed: string | null | undefined): number {
  if (!seed) return 7;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 100000);
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
    "#" + rgbTriple.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** health score to severity. 90 is nearly clear, 40 is clearly marked. */
function severityOf(score: number | undefined): number {
  if (score === undefined) return 0.5;
  return clamp01((100 - score) / 100);
}

/** how many marks to keep for this severity, capped by what was measured */
function densityCap(count: number, severity: number, max: number): number {
  if (count === 0) return 0;
  const wanted = Math.round(max * (0.18 + severity * 1.25));
  return Math.max(1, Math.min(count, Math.min(max, wanted)));
}

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
function strokePath(m: MarkedRegion, half: number, bow: number, deg: number): string {
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
function blob(
  m: MarkedRegion,
  i: number,
  accent: string,
  spread: number,
  alpha: number,
): MarkerShape {
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
  guides: FaceGuides | null,
): MarkerShape[] {
  const r = Math.max(0.0035, m.r * scale);
  const opacity = Math.min(0.9, 0.45 + m.intensity * 0.45);
  const out: MarkerShape[] = [];
  for (let k = 0; k < count; k++) {
    const ang = wobble(i, k + 10) * Math.PI * 2;
    const dist = wobble(i, k + 30) * m.r * 0.9;
    const cx = round(m.x + Math.cos(ang) * dist);
    const cy = round(m.y + Math.sin(ang) * dist);
    if (guides && !markable({ x: cx, y: cy }, guides)) continue;
    out.push({
      kind: "circle",
      cx,
      cy,
      r: round(r * (0.7 + wobble(i, k + 50) * 0.6)),
      fill: accent,
      opacity,
    });
  }
  return out;
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
function crescentAt(
  p: { x: number; y: number },
  width: number,
  thickness: number,
  accent: string,
  opacity: number,
): MarkerShape {
  const w = Math.max(0.02, width);
  const t = w * thickness;
  const d =
    `M ${round(p.x - w)} ${round(p.y - t * 0.3)} Q ${round(p.x)} ${round(p.y + t * 1.6)} ${round(p.x + w)} ${round(p.y - t * 0.3)}` +
    ` Q ${round(p.x)} ${round(p.y + t * 0.5)} ${round(p.x - w)} ${round(p.y - t * 0.3)} Z`;
  return { kind: "path", d, fill: accent, opacity };
}

/** breakouts: filled centre at 40 percent with a ring at full accent */
function spot(m: MarkedRegion, accent: string): MarkerShape[] {
  const r = Math.max(0.009, m.r * 0.9);
  const base = Math.min(0.95, 0.55 + m.intensity * 0.4);
  return [
    { kind: "circle", cx: round(m.x), cy: round(m.y), r: round(r), fill: accent, opacity: 0.4 },
    {
      kind: "path",
      d: ellipsePath(m.x, m.y, r * 1.35, r * 1.35, 0),
      stroke: accent,
      strokeWidth: 0.0035,
      opacity: base,
    },
  ];
}

/** a soft disc with a dashed edge, used by volume loss */
function deflate(p: { x: number; y: number }, r: number, accent: string, alpha: number): MarkerShape[] {
  return [
    { kind: "circle", cx: round(p.x), cy: round(p.y), r: round(r), fill: accent, opacity: alpha * 0.2 },
    {
      kind: "path",
      d: ellipsePath(p.x, p.y, r, r * 0.78, 0),
      stroke: accent,
      strokeWidth: 0.004,
      dash: "0.012 0.012",
      opacity: alpha,
    },
  ];
}

function pathShape(
  d: string,
  accent: string,
  weight: number,
  opacity: number,
  dash?: string,
): MarkerShape {
  return { kind: "path", d, stroke: accent, strokeWidth: weight, dash, opacity };
}

export interface MarkerDrawInput {
  regions: MarkedRegion[];
  accent: string;
  overlayKind?: string;
  /** cap the marker count, used by the small thumbnails */
  limit?: number;
  /** health score 0..100, drives density */
  score?: number;
  /** layer 1 landmarks. without them we cannot mark a photo at all. */
  landmarks?: Landmark[] | null;
  /** scan id, so model placed marks are deterministic */
  seed?: string | null;
  placementMethod?: string;
}

/**
 * turns measured regions and real landmark contours into the shapes to paint.
 * same input, same output, every time, in the app and in the report.
 */
export function markerDrawing({
  regions,
  accent,
  overlayKind = "patches_soft",
  limit,
  score,
  landmarks,
  seed,
  placementMethod,
}: MarkerDrawInput): MarkerDrawing {
  const guides = faceGuides(landmarks);
  const ink = photoAccent(accent);
  const severity = severityOf(score);
  const seedNum = seedFrom(seed);
  const shapes: MarkerShape[] = [];

  // nothing measured, nothing marked
  const inside = (regions ?? []).filter(
    (m) => m.intensity > 0 && (!guides || markable({ x: m.x, y: m.y }, guides)),
  );
  const ordered = [...inside].sort((a, b) => b.intensity - a.intensity);
  const cap = limit ?? densityCap(ordered.length, severity, 34);
  const marks = ordered.slice(0, Math.max(0, Math.min(cap, limit ?? cap)));

  const finish = (blur: number): MarkerDrawing => ({
    shapes,
    blur,
    clipPath: guides?.clipPath,
    placementMethod,
  });

  const scale = guides ? guides.bounds.w : 0.6;
  const alpha = Math.min(0.85, 0.4 + severity * 0.45);
  const weight = Math.max(0.003, scale * 0.008);

  /* ---------- contour led indicators: drawn on the real landmark paths ---------- */

  if (overlayKind === "strokes_long" || overlayKind === "strokes_short") {
    if (guides) {
      const fine = overlayKind === "strokes_short";
      const foreheadCount = Math.max(1, Math.round((fine ? 2 : 3) * (0.4 + severity)));
      guides.forehead.slice(0, foreheadCount).forEach((curve: Polyline, i) => {
        const trimmed = fine ? curve.slice(1, -1) : curve;
        shapes.push(
          pathShape(polylinePath(trimmed), ink, weight * (fine ? 0.6 : 1), alpha - i * 0.06),
        );
      });
      const feet = Math.max(2, Math.round(guides.crowsFeet.length * (0.35 + severity * 0.65)));
      guides.crowsFeet.slice(0, feet).forEach((f) => {
        const short = fine ? [f[0]!, { x: (f[0]!.x + f[1]!.x) / 2, y: (f[0]!.y + f[1]!.y) / 2 }] : f;
        shapes.push(pathShape(polylinePath(short), ink, weight * (fine ? 0.6 : 0.85), alpha));
      });
      return finish(fine ? 0.002 : 0.003);
    }
  }

  if (overlayKind === "arc_upper" && guides) {
    guides.upperLids.forEach((lid) => {
      shapes.push(pathShape(polylinePath(lid), ink, weight * 1.3, alpha));
    });
    return finish(0.004);
  }

  if (overlayKind === "crescent_thin" && guides) {
    guides.tearTroughs.forEach((lid) => {
      // inner corner outward, the first half of the lower lid contour
      shapes.push(pathShape(polylinePath(lid.slice(0, Math.ceil(lid.length * 0.7))), ink, weight, alpha));
    });
    return finish(0.004);
  }

  if ((overlayKind === "crescent" || overlayKind === "crescent_soft") && guides) {
    const soft = overlayKind === "crescent_soft";
    guides.underEyes.forEach((p) => {
      shapes.push(
        crescentAt(
          { x: p.x, y: p.y + guides.bounds.h * (soft ? 0.035 : 0.02) },
          guides.bounds.w * 0.11,
          soft ? 0.55 : 0.62,
          ink,
          alpha,
        ),
      );
    });
    return finish(soft ? 0.012 : 0.005);
  }

  if (overlayKind === "contour" && guides && guides.jawline.length > 3) {
    shapes.push(pathShape(polylinePath(guides.jawline), ink, weight, alpha));
    const count = Math.max(3, Math.round(9 * (0.3 + severity)));
    for (const d of chevronsAlong(guides.jawline, count, scale * 0.022)) {
      shapes.push(pathShape(d, ink, weight * 0.8, alpha * 0.9));
    }
    return finish(0.004);
  }

  if (overlayKind === "deflate" && guides) {
    const spots = [...guides.temples, ...guides.midCheeks];
    spots.forEach((p, i) => {
      const r = scale * (i < guides.temples.length ? 0.085 : 0.11) * (0.7 + severity * 0.5);
      shapes.push(...deflate(p, r, ink, alpha));
      shapes.push(pathShape(inwardArrow(p, guides.midline, scale * 0.05), ink, weight * 0.8, alpha));
    });
    return finish(0.006);
  }

  if (overlayKind === "axis" && guides) {
    const dash = "0.02 0.016";
    const { x, w } = guides.bounds;
    shapes.push(
      {
        kind: "line",
        x1: guides.midline,
        y1: round(guides.bounds.y),
        x2: guides.midline,
        y2: round(guides.bounds.y + guides.bounds.h),
        stroke: ink,
        strokeWidth: weight * 0.7,
        dash,
        opacity: 0.55,
      },
      {
        kind: "line",
        x1: round(x),
        y1: guides.browY,
        x2: round(x + w),
        y2: guides.browY,
        stroke: ink,
        strokeWidth: weight * 0.7,
        dash,
        opacity: 0.5,
      },
      {
        kind: "line",
        x1: round(x),
        y1: guides.mouthY,
        x2: round(x + w),
        y2: guides.mouthY,
        stroke: ink,
        strokeWidth: weight * 0.7,
        dash,
        opacity: 0.5,
      },
    );
    // the two cheek circles are sized by the measured difference between sides
    const sideMark = (leftSide: boolean) =>
      inside.find((m) => (leftSide ? m.x > guides.midline : m.x <= guides.midline));
    guides.cheeks.forEach((p) => {
      const m = sideMark(p.x > guides.midline);
      const diff = m ? m.intensity : severity;
      const r = scale * (0.07 + diff * 0.1);
      shapes.push({
        kind: "circle",
        cx: round(p.x),
        cy: round(p.y),
        r: round(r),
        fill: ink,
        opacity: Math.min(0.6, 0.2 + diff * 0.35),
      });
    });
    return finish(0.016);
  }

  /* ---------- measured indicators: drawn where the pixels actually read ---------- */

  if (!marks.length) return finish(0);

  const drawMark = (m: MarkedRegion, i: number) => {
    const salt = i + seedNum;
    switch (overlayKind) {
      case "bloom":
        return blob(m, salt, ink, 2.1, 0.26);
      case "cloud":
        return blob(m, salt, ink, 2, 0.13);
      case "patches":
        // irregular blotches of varied size
        return blob(m, salt, ink, 1.1 + wobble(salt, 9) * 1.1, 0.32);
      case "patches_soft":
        return blob(m, salt, ink, 1.8, 0.24);
      case "dots_dense":
        return speck(m, salt, ink, 0.24, 9, guides);
      case "dots_scatter":
        return speck(m, salt, ink, 0.3, 6, guides);
      case "spots":
        return spot(m, ink);
      case "hatch":
        return stroke(m, salt, ink, { len: 0.8, weight: 0.38, bow: 1.7 });
      case "strokes_long":
        return stroke(m, salt, ink, { len: 1.4, weight: 0.1, bow: 0.6, angle: wobble(salt, 5) * 12 - 6 });
      case "strokes_short":
        return stroke(m, salt, ink, { len: 0.9, weight: 0.1, bow: 0.7, angle: wobble(salt, 6) * 60 - 30 });
      case "crescent":
      case "crescent_soft":
        return crescentAt({ x: m.x, y: m.y }, m.r * 2.2, 0.6, ink, Math.min(0.9, 0.5 + m.intensity * 0.4));
      case "crescent_thin":
        return stroke(m, salt, ink, { len: 2, weight: 0.12, bow: 1.1, angle: 0 });
      case "arc_upper":
        return stroke(m, salt, ink, { len: 2, weight: 0.16, bow: -1.2, angle: 0 });
      case "contour":
        return stroke(m, salt, ink, { len: 1.8, weight: 0.09, bow: 0.9, angle: 0, dash: "0.014 0.012" });
      case "deflate":
        return deflate({ x: m.x, y: m.y }, Math.max(0.03, m.r * 1.2), ink, Math.min(0.8, 0.45 + m.intensity * 0.35));
      case "axis":
        return blob(m, salt, ink, 1.3, 0.28);
      default:
        return blob(m, salt, ink, 1.4, 0.3);
    }
  };

  const BLUR: Record<string, number> = {
    bloom: 0.026,
    cloud: 0.03,
    patches: 0.014,
    patches_soft: 0.024,
    dots_dense: 0.0015,
    dots_scatter: 0.002,
    spots: 0.003,
    hatch: 0.003,
    strokes_long: 0.003,
    strokes_short: 0.002,
    crescent: 0.005,
    crescent_soft: 0.012,
    crescent_thin: 0.004,
    arc_upper: 0.005,
    contour: 0.004,
    deflate: 0.006,
    axis: 0.016,
  };

  marks.forEach((m, i) => {
    const out = drawMark(m, i);
    if (Array.isArray(out)) shapes.push(...out);
    else shapes.push(out);
  });

  return finish(BLUR[overlayKind] ?? 0.014);
}
