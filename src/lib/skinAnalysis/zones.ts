import type { ConcernKey } from "./types";

/** normalized (x,y) points on the face frame, 0..1 */
export const FACE_POINTS = {
  forehead: { x: 0.5, y: 0.2 },
  leftTemple: { x: 0.24, y: 0.28 },
  rightTemple: { x: 0.76, y: 0.28 },
  brow: { x: 0.5, y: 0.33 },
  underEyeL: { x: 0.35, y: 0.44 },
  underEyeR: { x: 0.65, y: 0.44 },
  nose: { x: 0.5, y: 0.53 },
  leftCheek: { x: 0.28, y: 0.56 },
  rightCheek: { x: 0.72, y: 0.56 },
  jaw: { x: 0.5, y: 0.79 },
  chin: { x: 0.5, y: 0.86 },
  lips: { x: 0.5, y: 0.72 },
} as const;

type PointKey = keyof typeof FACE_POINTS;

/** where each concern typically shows up, for the overlay */
export const CONCERN_ZONES: Record<ConcernKey, PointKey[]> = {
  hydration: ["leftCheek", "rightCheek", "forehead"],
  texture: ["leftCheek", "rightCheek", "chin"],
  pores: ["nose", "leftCheek", "rightCheek"],
  dullness: ["forehead", "leftCheek", "rightCheek"],
  fineLines: ["underEyeL", "underEyeR", "forehead"],
  wrinkles: ["forehead", "brow", "leftTemple", "rightTemple"],
  pigmentation: ["leftCheek", "rightCheek", "forehead"],
  darkSpots: ["leftCheek", "rightCheek", "nose"],
  redness: ["nose", "leftCheek", "rightCheek"],
  acne: ["chin", "forehead", "jaw"],
  acneScars: ["leftCheek", "rightCheek", "jaw"],
  underEyes: ["underEyeL", "underEyeR"],
  volumeLoss: ["leftCheek", "rightCheek", "lips"],
  laxity: ["jaw", "chin", "leftCheek", "rightCheek"],
  symmetry: ["brow", "lips", "jaw"],
};
