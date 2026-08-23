/**
 * layer 1 of marker placement. everything downstream depends on this.
 *
 * mediapipe face landmarker returns 478 points normalised 0 to 1 on the image
 * as supplied. we turn those points into zone polygons, and every marker the
 * app ever draws sits inside one of these polygons. no vision model is ever
 * asked for a coordinate again.
 *
 * polygons are built as convex hulls of standard face mesh index sets, so the
 * shape stays valid whatever order the indices are listed in.
 */

import type { Landmark } from "@/lib/facemesh";

export const ZONE_KEYS = [
  "forehead",
  "glabella",
  "temple_left",
  "temple_right",
  "nose",
  "left_cheek",
  "right_cheek",
  "under_eye_left",
  "under_eye_right",
  "upper_eyelid_left",
  "upper_eyelid_right",
  "perioral",
  "chin",
  "jawline_left",
  "jawline_right",
  "full_face",
] as const;

export type ZoneKey = (typeof ZONE_KEYS)[number];

/** left and right are the patient's own left and right, as mediapipe names them. */
export const ZONE_LABEL: Record<ZoneKey, string> = {
  forehead: "forehead",
  glabella: "between the brows",
  temple_left: "left temple",
  temple_right: "right temple",
  nose: "nose",
  left_cheek: "left cheek",
  right_cheek: "right cheek",
  under_eye_left: "under the left eye",
  under_eye_right: "under the right eye",
  upper_eyelid_left: "left eyelid",
  upper_eyelid_right: "right eyelid",
  perioral: "around the mouth",
  chin: "chin",
  jawline_left: "left jawline",
  jawline_right: "right jawline",
  full_face: "all over",
};

/**
 * standard face mesh indices per zone. hulled at runtime, so these are index
 * sets rather than ordered rings.
 */
const ZONE_INDICES: Record<ZoneKey, number[]> = {
  // brow line up to the top of the mesh oval
  forehead: [
    10, 151, 9, 8, 107, 336, 66, 296, 105, 334, 63, 293, 68, 298, 71, 301, 109, 338, 337, 108, 69,
    104, 299, 333,
  ],
  glabella: [9, 8, 168, 6, 107, 336, 55, 285, 193, 417, 108, 337],
  temple_left: [251, 284, 332, 389, 368, 264, 447, 356, 301, 298],
  temple_right: [21, 54, 103, 162, 139, 34, 227, 127, 71, 68],
  nose: [
    168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 326, 327, 129, 358, 45, 275, 220, 440, 236, 3,
    248, 456, 196, 419,
  ],
  left_cheek: [
    425, 426, 427, 436, 416, 376, 352, 411, 266, 329, 330, 347, 346, 345, 280, 371, 423, 266, 355,
  ],
  right_cheek: [
    205, 206, 207, 216, 192, 147, 123, 187, 36, 100, 101, 118, 117, 116, 50, 142, 203, 126,
  ],
  // lower lid ring plus the row of points sitting just under it
  under_eye_left: [
    362, 382, 381, 380, 374, 373, 390, 249, 263, 463, 341, 256, 252, 253, 254, 339, 255, 359, 446,
    450, 449, 448, 261,
  ],
  under_eye_right: [
    133, 155, 154, 153, 145, 144, 163, 7, 33, 243, 112, 26, 22, 23, 24, 110, 25, 130, 226, 230, 229,
    228, 31,
  ],
  upper_eyelid_left: [
    362, 398, 384, 385, 386, 387, 388, 466, 263, 446, 342, 445, 444, 443, 463, 467,
  ],
  upper_eyelid_right: [
    133, 173, 157, 158, 159, 160, 161, 246, 33, 226, 113, 225, 224, 223, 222, 221, 243, 247,
  ],
  perioral: [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 164,
    393, 167, 165, 92, 322, 206, 426, 57, 287, 2,
  ],
  chin: [152, 148, 176, 377, 400, 378, 379, 175, 199, 200, 18, 17, 313, 83, 182, 406, 149, 150],
  jawline_left: [152, 377, 378, 379, 365, 397, 288, 361, 323, 454, 356, 288, 435],
  jawline_right: [152, 148, 149, 150, 136, 172, 58, 132, 93, 234, 127, 215],
  full_face: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
    148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  ],
};

/** zones we exclude from pigmentation and texture reads: hair, lashes, lips, nostrils. */
const MASK_INDICES: Record<string, number[]> = {
  brow_left: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  brow_right: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  eye_left: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  eye_right: [133, 155, 154, 153, 145, 144, 163, 7, 33, 246, 161, 160, 159, 158, 157, 173],
  lips: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  nostrils: [98, 97, 2, 326, 327, 358, 129, 64, 294],
};

export type Point = { x: number; y: number };
export type Polygon = Point[];

export type FaceZones = Record<ZoneKey, Polygon>;

export interface FaceMap {
  /** the raw 478 points, normalised to the image as supplied */
  landmarks: Landmark[];
  /** zone polygons, same normalised space */
  zones: FaceZones;
  /** areas we never mark: brows, lashes, lips, nostrils */
  masks: Polygon[];
  /** bounding box of the whole face, normalised */
  bounds: { x: number; y: number; w: number; h: number };
  /** x of the facial midline, used by the symmetry read */
  midline: number;
}

/* ---------- geometry ---------- */

const cross = (o: Point, a: Point, b: Point) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** monotone chain hull. keeps polygons valid however the indices are ordered. */
export function convexHull(points: Point[]): Polygon {
  if (points.length < 4) return [...points];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const build = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = build(sorted);
  const upper = build([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function pointInPolygon(p: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonBounds(poly: Polygon): { x: number; y: number; w: number; h: number } {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) };
}

export function polygonCentroid(poly: Polygon): Point {
  if (!poly.length) return { x: 0.5, y: 0.5 };
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/** shrink a polygon toward its centroid so markers never sit on the edge */
export function insetPolygon(poly: Polygon, factor = 0.85): Polygon {
  const c = polygonCentroid(poly);
  return poly.map((p) => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor }));
}

/* ---------- building the map ---------- */

function pick(landmarks: Landmark[], indices: number[]): Point[] {
  const out: Point[] = [];
  const seen = new Set<number>();
  for (const i of indices) {
    if (seen.has(i)) continue;
    seen.add(i);
    const p = landmarks[i];
    if (p) out.push({ x: round(p.x), y: round(p.y) });
  }
  return out;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** the whole layer 1 output. null when there is no usable face. */
export function buildFaceMap(landmarks: Landmark[] | null | undefined): FaceMap | null {
  if (!landmarks || landmarks.length < 468) return null;

  const zones = {} as FaceZones;
  for (const key of ZONE_KEYS) {
    const hull = convexHull(pick(landmarks, ZONE_INDICES[key]));
    if (hull.length < 3) return null;
    zones[key] = hull;
  }

  const masks = Object.values(MASK_INDICES)
    .map((indices) => convexHull(pick(landmarks, indices)))
    .filter((poly) => poly.length >= 3);

  const bounds = polygonBounds(zones.full_face);
  if (bounds.w < 0.05 || bounds.h < 0.05) return null;

  // the midline runs through the nose bridge and chin, not the bbox centre,
  // so a slightly turned face still mirrors sensibly.
  const bridge = landmarks[168];
  const chinTip = landmarks[152];
  const midline = round(
    bridge && chinTip ? (bridge.x + chinTip.x) / 2 : bounds.x + bounds.w / 2,
  );

  return {
    landmarks: landmarks.map((p) => ({ x: round(p.x), y: round(p.y), z: round(p.z) })),
    zones,
    masks,
    bounds,
    midline,
  };
}

export type MappingMethod = "landmarks" | "fallback_diagram";

/** never place markers without a detected face. */
export function mappingMethodFor(map: FaceMap | null): MappingMethod {
  return map ? "landmarks" : "fallback_diagram";
}

/** true when a point sits in an area we never mark */
export function isMasked(p: Point, masks: Polygon[]): boolean {
  return masks.some((m) => pointInPolygon(p, m));
}
