// overlay geometry for the analysis screens.
// shapes are authored in a 0..100 face-local space and then placed inside the
// face box that facemesh landmarks give us, so every overlay lands on the
// user's actual face rather than the middle of the photo.

import type { Landmark } from "@/lib/facemesh";

export type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "path"; d: string };

export type OverlayMode = "filled" | "stroked" | "outline";

const R: Record<string, Shape[]> = {
  fullFace: [{ kind: "ellipse", cx: 50, cy: 52, rx: 41, ry: 47 }],
  contour: [{ kind: "ellipse", cx: 50, cy: 52, rx: 41, ry: 47 }],
  cheeks: [
    { kind: "ellipse", cx: 27, cy: 58, rx: 14, ry: 13 },
    { kind: "ellipse", cx: 73, cy: 58, rx: 14, ry: 13 },
  ],
  nose: [{ kind: "ellipse", cx: 50, cy: 52, rx: 8, ry: 13 }],
  chin: [{ kind: "ellipse", cx: 50, cy: 87, rx: 12, ry: 7 }],
  forehead: [{ kind: "ellipse", cx: 50, cy: 20, rx: 25, ry: 13 }],
  tZone: [{ kind: "path", d: "M33 9 H67 V29 H58 V64 H42 V29 H33 Z" }],
  midface: [
    { kind: "ellipse", cx: 32, cy: 51, rx: 12, ry: 10 },
    { kind: "ellipse", cx: 68, cy: 51, rx: 12, ry: 10 },
  ],
  underEye: [
    { kind: "path", d: "M26 43 Q36 37 46 43 Q36 52 26 43 Z" },
    { kind: "path", d: "M54 43 Q64 37 74 43 Q64 52 54 43 Z" },
  ],
  tearTrough: [
    { kind: "path", d: "M28 46 Q37 53 46 47" },
    { kind: "path", d: "M54 47 Q63 53 72 46" },
  ],
  upperLid: [
    { kind: "path", d: "M27 36 Q36 30 45 36" },
    { kind: "path", d: "M55 36 Q64 30 73 36" },
  ],
  jawline: [{ kind: "path", d: "M15 58 Q22 90 50 96 Q78 90 85 58" }],
  lowerCheekArcs: [
    { kind: "path", d: "M22 60 Q30 75 43 79" },
    { kind: "path", d: "M78 60 Q70 75 57 79" },
  ],
  foreheadLines: [
    { kind: "path", d: "M30 13 Q50 9 70 13" },
    { kind: "path", d: "M31 20 Q50 16 69 20" },
    { kind: "path", d: "M33 27 Q50 23 67 27" },
  ],
  glabellar: [
    { kind: "path", d: "M46 29 V38" },
    { kind: "path", d: "M53 29 V38" },
  ],
  crowsfeet: [
    { kind: "path", d: "M20 40 L11 35" },
    { kind: "path", d: "M20 42 L10 42" },
    { kind: "path", d: "M20 44 L11 49" },
    { kind: "path", d: "M80 40 L89 35" },
    { kind: "path", d: "M80 42 L90 42" },
    { kind: "path", d: "M80 44 L89 49" },
  ],
  nasolabial: [
    { kind: "path", d: "M43 59 Q38 71 34 79" },
    { kind: "path", d: "M57 59 Q62 71 66 79" },
  ],
  marionette: [
    { kind: "path", d: "M39 80 Q37 88 39 93" },
    { kind: "path", d: "M61 80 Q63 88 61 93" },
  ],
  breakouts: [
    { kind: "ellipse", cx: 50, cy: 20, rx: 22, ry: 11 },
    { kind: "ellipse", cx: 28, cy: 58, rx: 12, ry: 11 },
    { kind: "ellipse", cx: 72, cy: 58, rx: 12, ry: 11 },
    { kind: "ellipse", cx: 50, cy: 86, rx: 12, ry: 7 },
  ],
};

export interface OverlaySpec {
  mode: OverlayMode;
  shapes: Shape[];
}

/** which regions each of the 16 concerns paints, and how */
export const CONCERN_OVERLAY: Record<string, OverlaySpec> = {
  redness: { mode: "filled", shapes: [...R.cheeks, ...R.nose, ...R.chin, ...R.forehead] },
  pores: { mode: "filled", shapes: [...R.tZone, ...R.cheeks] },
  oiliness: { mode: "filled", shapes: R.tZone },
  breakouts: { mode: "filled", shapes: R.breakouts },
  pigmentation: { mode: "filled", shapes: [...R.cheeks, ...R.forehead] },
  uniformness: { mode: "filled", shapes: R.fullFace },
  radiance: { mode: "outline", shapes: R.contour },
  hydration: { mode: "filled", shapes: R.fullFace },
  texture: { mode: "filled", shapes: R.fullFace },
  lines: {
    mode: "stroked",
    shapes: [...R.foreheadLines, ...R.glabellar, ...R.crowsfeet, ...R.nasolabial, ...R.marionette],
  },
  firmness: { mode: "stroked", shapes: [...R.jawline, ...R.lowerCheekArcs] },
  volume_loss: { mode: "filled", shapes: R.midface },
  dark_circles: { mode: "filled", shapes: R.underEye },
  under_eye_puffiness: { mode: "filled", shapes: R.underEye },
  tear_trough: { mode: "stroked", shapes: R.tearTrough },
  eyelid_heaviness: { mode: "stroked", shapes: R.upperLid },
};

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** a sensible box for photos where facemesh didn't return landmarks */
export const DEFAULT_FACE_BOX: FaceBox = { x: 0.19, y: 0.08, w: 0.62, h: 0.82 };

export function faceBoxFromLandmarks(landmarks: Landmark[] | null | undefined): FaceBox {
  if (!landmarks?.length) return DEFAULT_FACE_BOX;
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // facemesh stops at the brow line; open the box up a little for the forehead
  const h = maxY - minY;
  const top = Math.max(0, minY - h * 0.16);
  return { x: minX, y: top, w: maxX - minX, h: maxY - top };
}
