// canonical concern vocabulary for the scan. nothing outside this module
// should hardcode a different list.
export const CONCERN_KEYS = [
  "hydration",
  "texture",
  "pores",
  "dullness",
  "fineLines",
  "wrinkles",
  "pigmentation",
  "darkSpots",
  "redness",
  "acne",
  "acneScars",
  "underEyes",
  "volumeLoss",
  "laxity",
  "symmetry",
] as const;

export type ConcernKey = (typeof CONCERN_KEYS)[number];

export const CONCERN_LABEL: Record<ConcernKey, string> = {
  hydration: "hydration",
  texture: "texture",
  pores: "pores",
  dullness: "dullness",
  fineLines: "fine lines",
  wrinkles: "wrinkles",
  pigmentation: "pigmentation",
  darkSpots: "dark spots",
  redness: "redness",
  acne: "acne",
  acneScars: "acne scars",
  underEyes: "under eyes",
  volumeLoss: "volume loss",
  laxity: "laxity",
  symmetry: "symmetry",
};

/** one marked place on the patient photo, in normalised image coordinates */
export interface MarkedRegion {
  x: number;
  y: number;
  r: number;
  intensity: number;
}

export interface ConcernResult {
  key: ConcernKey;
  score: number;
  confidence: number;
  assessable: boolean;
  /** where this shows up on the photo. empty when the read found nothing to mark. */
  regions?: MarkedRegion[];
}

export interface ImageQuality {
  ok: boolean;
  issues: string[];
}

export interface ScanResult {
  scan_id: string;
  model_version: string;
  image_quality: ImageQuality;
  concerns: ConcernResult[];
}

/** a single captured image, as a data url plus optional storage path */
export interface ScanImage {
  dataUrl: string;
  storagePath?: string | null;
}

export interface AnalysisProvider {
  name: string;
  analyze(images: ScanImage[]): Promise<ScanResult>;
}
