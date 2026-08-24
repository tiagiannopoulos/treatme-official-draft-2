/**
 * real landmark contours, used by the indicators whose markings must follow the
 * anatomy rather than a measured blob: the forehead and crow's feet lines, the
 * upper lid arc, the tear trough, the jawline and the symmetry references.
 *
 * everything here is normalised 0..1 against the photo, the same space markers
 * are drawn in, so the app and the pdf read identical numbers.
 */

import type { Landmark } from "@/lib/facemesh";
import { buildFaceMap, insetPolygon, pointInPolygon, type Point, type Polygon } from "@/lib/face-zones";

export type Polyline = Point[];

export interface FaceGuides {
  /** the face outline markers are clipped to */
  clip: Polygon;
  /** svg path of that outline, for a clipPath in either renderer */
  clipPath: string;
  /** never mark: brows, lashes, lips, nostrils */
  masks: Polygon[];
  bounds: { x: number; y: number; w: number; h: number };
  midline: number;
  browY: number;
  mouthY: number;
  /** long horizontal forehead contours, top to bottom */
  forehead: Polyline[];
  /** short angled strokes at each outer eye */
  crowsFeet: Polyline[];
  /** upper lid line per eye */
  upperLids: Polyline[];
  /** inner corner outward, along the lower lid */
  tearTroughs: Polyline[];
  /** under eye hollow centres, left then right */
  underEyes: Point[];
  /** the jaw contour, ear to ear under the chin */
  jawline: Polyline;
  /** temples then mid cheeks, used by volume loss */
  temples: Point[];
  midCheeks: Point[];
  /** cheek centres, used by the symmetry circles */
  cheeks: Point[];
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

const LID_LEFT = [263, 466, 388, 387, 386, 385, 384, 398, 362];
const LID_RIGHT = [33, 246, 161, 160, 159, 158, 157, 173, 133];
const LOWER_LEFT = [362, 381, 380, 374, 373, 390, 249, 263];
const LOWER_RIGHT = [133, 154, 153, 145, 144, 163, 7, 33];
const JAW = [132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361];

function at(l: Landmark[], i: number): Point | null {
  const p = l[i];
  return p ? { x: r4(p.x), y: r4(p.y) } : null;
}

function line(l: Landmark[], indices: number[]): Polyline {
  return indices.map((i) => at(l, i)).filter((p): p is Point => Boolean(p));
}

const mid = (a: Point, b: Point): Point => ({ x: r4((a.x + b.x) / 2), y: r4((a.y + b.y) / 2) });

/** a smooth path through a polyline, quadratic midpoints so no renderer needs curves it lacks */
export function polylinePath(points: Polyline): string {
  if (points.length < 2) return "";
  let d = `M ${r4(points[0]!.x)} ${r4(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const n = points[i + 1]!;
    d += ` Q ${r4(p.x)} ${r4(p.y)} ${r4((p.x + n.x) / 2)} ${r4((p.y + n.y) / 2)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${r4(last.x)} ${r4(last.y)}`;
  return d;
}

/** closed polygon path, used for the face clip */
export function polygonPath(poly: Polygon): string {
  if (poly.length < 3) return "";
  return `${poly.map((p, i) => `${i === 0 ? "M" : "L"} ${r4(p.x)} ${r4(p.y)}`).join(" ")} Z`;
}

/** shifts a polyline along its own normal, used to stack the forehead contours */
function offsetLine(points: Polyline, dy: number): Polyline {
  return points.map((p) => ({ x: p.x, y: r4(p.y + dy) }));
}

/** the whole guide set. null when there is no usable face, which is the diagram fallback. */
export function faceGuides(landmarks: Landmark[] | null | undefined): FaceGuides | null {
  const map = buildFaceMap(landmarks);
  if (!map || !landmarks) return null;
  const l = landmarks;

  const browL = at(l, 334);
  const browR = at(l, 105);
  const mouth = at(l, 13);
  const top = at(l, 10);
  const foreheadL = at(l, 301);
  const foreheadR = at(l, 71);
  if (!browL || !browR || !mouth || !top || !foreheadL || !foreheadR) return null;

  const browY = r4((browL.y + browR.y) / 2);
  const foreheadH = Math.max(0.02, browY - top.y);

  // one contour through the brow tops, copied upward across the forehead
  const base: Polyline = [
    { x: r4(foreheadR.x + (browR.x - foreheadR.x) * 0.25), y: r4(browY - foreheadH * 0.28) },
    { x: browR.x, y: r4(browY - foreheadH * 0.36) },
    { x: r4((browR.x + browL.x) / 2), y: r4(browY - foreheadH * 0.42) },
    { x: browL.x, y: r4(browY - foreheadH * 0.36) },
    { x: r4(foreheadL.x + (browL.x - foreheadL.x) * 0.25), y: r4(browY - foreheadH * 0.28) },
  ];
  const forehead = [
    offsetLine(base, 0),
    offsetLine(base, -foreheadH * 0.2),
    offsetLine(base, -foreheadH * 0.4),
  ];

  // crow's feet: three short strokes fanning back from each outer canthus
  const fan = (corner: Point, dir: 1 | -1, span: number): Polyline[] =>
    [-1, 0, 1].map((k) => [
      corner,
      {
        x: r4(corner.x + dir * span),
        y: r4(corner.y + k * span * 0.75),
      },
    ]);
  const outerL = at(l, 263);
  const outerR = at(l, 33);
  const span = map.bounds.w * 0.07;
  const crowsFeet = [
    ...(outerL ? fan(outerL, 1, span) : []),
    ...(outerR ? fan(outerR, -1, span) : []),
  ];

  const lowerL = line(l, LOWER_LEFT);
  const lowerR = line(l, LOWER_RIGHT);
  const underEyes = [lowerL, lowerR]
    .filter((p) => p.length > 2)
    .map((p) => p[Math.floor(p.length / 2)]!);

  const cheekL = at(l, 425) ?? at(l, 330);
  const cheekR = at(l, 205) ?? at(l, 101);
  const templeL = at(l, 447);
  const templeR = at(l, 227);

  return {
    clip: insetPolygon(map.zones.full_face, 0.99),
    clipPath: polygonPath(insetPolygon(map.zones.full_face, 0.99)),
    masks: map.masks,
    bounds: map.bounds,
    midline: map.midline,
    browY,
    mouthY: mouth.y,
    forehead,
    crowsFeet,
    upperLids: [line(l, LID_LEFT), line(l, LID_RIGHT)].filter((p) => p.length > 2),
    tearTroughs: [lowerL, lowerR].filter((p) => p.length > 2),
    underEyes,
    jawline: line(l, JAW),
    temples: [templeL, templeR].filter((p): p is Point => Boolean(p)).map((p, i) => ({
      x: r4(p.x + (i === 0 ? -1 : 1) * 0.012),
      y: r4(p.y),
    })),
    midCheeks: [cheekL, cheekR].filter((p): p is Point => Boolean(p)),
    cheeks: [cheekL, cheekR].filter((p): p is Point => Boolean(p)),
  };
}

/** true when a point may be marked: inside the face, outside every mask */
export function markable(p: Point, guides: FaceGuides): boolean {
  if (!pointInPolygon(p, guides.clip)) return false;
  return !guides.masks.some((m) => pointInPolygon(p, m));
}

/** small chevrons along a contour, used by firmness */
export function chevronsAlong(points: Polyline, count: number, size: number): string[] {
  if (points.length < 2) return [];
  const out: string[] = [];
  for (let k = 1; k <= count; k++) {
    const t = k / (count + 1);
    const i = Math.min(points.length - 2, Math.floor(t * (points.length - 1)));
    const a = points[i]!;
    const b = points[i + 1]!;
    const p = mid(a, b);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    const tipX = p.x + nx * size;
    const tipY = p.y + ny * size;
    out.push(
      `M ${r4(p.x - tx * size)} ${r4(p.y - ty * size)} L ${r4(tipX)} ${r4(tipY)} L ${r4(p.x + tx * size)} ${r4(p.y + ty * size)}`,
    );
  }
  return out;
}

/** a short arrow pointing toward the face centre, used by volume loss */
export function inwardArrow(p: Point, midline: number, size: number): string {
  const dir = p.x > midline ? -1 : 1;
  const tipX = p.x + dir * size;
  return (
    `M ${r4(p.x - dir * size * 0.4)} ${r4(p.y)} L ${r4(tipX)} ${r4(p.y)}` +
    ` M ${r4(tipX)} ${r4(p.y)} L ${r4(tipX - dir * size * 0.45)} ${r4(p.y - size * 0.35)}` +
    ` M ${r4(tipX)} ${r4(p.y)} L ${r4(tipX - dir * size * 0.45)} ${r4(p.y + size * 0.35)}`
  );
}
