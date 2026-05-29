import { z } from "zod";

export const MARKER_KEYS = [
  "hydration",
  "pores",
  "fineLines",
  "wrinkles",
  "pigmentation",
  "volumeLoss",
  "darkSpots",
  "texture",
  "redness",
  "symmetry",
] as const;

export type MarkerKey = (typeof MARKER_KEYS)[number];

export const MARKER_LABEL: Record<MarkerKey, string> = {
  hydration: "hydration",
  pores: "pores",
  fineLines: "fine lines",
  wrinkles: "wrinkles",
  pigmentation: "pigmentation",
  volumeLoss: "volume loss",
  darkSpots: "dark spots",
  texture: "texture",
  redness: "redness",
  symmetry: "symmetry",
};

// 6 canonical face zones we ask the model to localize to.
// Each maps to a normalized (x,y) on a face-shaped canvas (0..1).
export const FACE_ZONES = [
  "forehead",
  "left_cheek",
  "right_cheek",
  "nose",
  "chin",
  "under_eyes",
  "left_temple",
  "right_temple",
  "jawline",
  "lips",
  "brow",
] as const;
export type FaceZone = (typeof FACE_ZONES)[number];

export const ZONE_POINTS: Record<FaceZone, { x: number; y: number }> = {
  forehead: { x: 0.5, y: 0.18 },
  left_temple: { x: 0.22, y: 0.27 },
  right_temple: { x: 0.78, y: 0.27 },
  brow: { x: 0.5, y: 0.32 },
  under_eyes: { x: 0.5, y: 0.44 },
  left_cheek: { x: 0.28, y: 0.55 },
  right_cheek: { x: 0.72, y: 0.55 },
  nose: { x: 0.5, y: 0.52 },
  lips: { x: 0.5, y: 0.72 },
  chin: { x: 0.5, y: 0.84 },
  jawline: { x: 0.5, y: 0.78 },
};

export const MarkerSchema = z.object({
  score: z.number().min(0).max(100),
  note: z.string().max(160),
  zones: z.array(z.enum(FACE_ZONES)).min(0).max(6),
});

export const AnalysisSchema = z.object({
  skinType: z.enum(["oily", "dry", "combination", "normal", "sensitive"]),
  fitzpatrick: z.enum(["I", "II", "III", "IV", "V", "VI"]),
  skinAge: z.number().min(10).max(90),
  markers: z.object({
    hydration: MarkerSchema,
    pores: MarkerSchema,
    fineLines: MarkerSchema,
    wrinkles: MarkerSchema,
    pigmentation: MarkerSchema,
    volumeLoss: MarkerSchema,
    darkSpots: MarkerSchema,
    texture: MarkerSchema,
    redness: MarkerSchema,
    symmetry: MarkerSchema,
  }),
  blurb: z.string().min(40).max(600),
  strengths: z.array(z.string()).min(1).max(5),
  weaknesses: z.array(z.string()).min(1).max(5),
  recommendedTreatments: z.array(z.string()).min(2).max(6),
});

export type SkinAnalysis = z.infer<typeof AnalysisSchema>;
