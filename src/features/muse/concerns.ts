import { z } from "zod";

/**
 * treatme skin analysis taxonomy.
 * 16 concerns in 4 groups. scores are 0-100, higher = better.
 * bands: great 90-100, good 80-89, average 50-79, "focus here" below 50.
 * the word "poor" is never used. there is no skin age metric.
 */

export const CONCERN_GROUPS = [
  {
    key: "texture_clarity",
    label: "texture and clarity",
    concerns: [
      { key: "pores", label: "pores", blurb: "how tight and refined your pores look." },
      { key: "breakouts", label: "breakouts", blurb: "active blemishes and congestion." },
      { key: "texture", label: "texture", blurb: "how smooth and even your skin feels to the eye." },
      { key: "oiliness", label: "oiliness", blurb: "excess shine, mostly in the t-zone." },
    ],
  },
  {
    key: "tone_pigment",
    label: "tone and pigment",
    concerns: [
      { key: "redness", label: "redness", blurb: "flushing and background redness." },
      { key: "pigmentation", label: "pigmentation", blurb: "dark spots and uneven melanin." },
      { key: "uniformness", label: "uniformness", blurb: "how even your overall skin tone reads." },
      { key: "radiance", label: "radiance", blurb: "that lit-from-within glow factor." },
    ],
  },
  {
    key: "aging_structure",
    label: "aging and structure",
    concerns: [
      { key: "lines", label: "lines", blurb: "fine lines and deeper wrinkles." },
      { key: "firmness", label: "firmness", blurb: "how lifted and springy skin looks." },
      { key: "volume_loss", label: "volume loss", blurb: "hollowness, mostly midface." },
      { key: "hydration", label: "hydration", blurb: "plumpness from water, not oil." },
    ],
  },
  {
    key: "eye_area",
    label: "eye area",
    concerns: [
      { key: "dark_circles", label: "dark circles", blurb: "shadow and discoloration under the eyes." },
      { key: "under_eye_puffiness", label: "under-eye puffiness", blurb: "morning bags and fluid." },
      { key: "tear_trough", label: "tear trough", blurb: "the groove from inner eye to cheek." },
      { key: "eyelid_heaviness", label: "eyelid heaviness", blurb: "how heavy the upper lids sit." },
    ],
  },
] as const;

export const CONCERN_KEYS = CONCERN_GROUPS.flatMap((g) =>
  g.concerns.map((c) => c.key),
) as unknown as readonly [
  "pores",
  "breakouts",
  "texture",
  "oiliness",
  "redness",
  "pigmentation",
  "uniformness",
  "radiance",
  "lines",
  "firmness",
  "volume_loss",
  "hydration",
  "dark_circles",
  "under_eye_puffiness",
  "tear_trough",
  "eyelid_heaviness",
];

export type ConcernKey = (typeof CONCERN_KEYS)[number];

export const CONCERN_LABELS: Record<ConcernKey, string> = Object.fromEntries(
  CONCERN_GROUPS.flatMap((g) => g.concerns.map((c) => [c.key, c.label])),
) as Record<ConcernKey, string>;

export type Band = "great" | "good" | "average" | "focus here";

export function bandFor(score: number): Band {
  if (score >= 90) return "great";
  if (score >= 80) return "good";
  if (score >= 50) return "average";
  return "focus here";
}

export const BAND_ORDER: Band[] = ["focus here", "average", "good", "great"];

export const FREE_SCANS_PER_DAY = 5;

/* ---------- zod schemas (shared client/server) ---------- */

export const ConcernScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  explanation: z.string().min(1).max(400),
});

const concernsShape = Object.fromEntries(
  CONCERN_KEYS.map((k) => [k, ConcernScoreSchema]),
) as { [K in ConcernKey]: typeof ConcernScoreSchema };

export const AnalysisResultSchema = z.object({
  concerns: z.object(concernsShape),
  top_priorities: z.array(z.enum(CONCERN_KEYS)).min(1).max(3),
  summary: z.string().min(1).max(600),
  fitzpatrick: z.enum(["I", "II", "III", "IV", "V", "VI"]).optional(),
  medical_flag: z.string().max(200).nullable().optional(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type ConcernScore = z.infer<typeof ConcernScoreSchema>;

export interface ScanRecord {
  id: string;
  created_at: string;
  scores: Record<ConcernKey, number>;
  explanations: Record<ConcernKey, string>;
  top_priorities: ConcernKey[];
  summary: string;
  fitzpatrick?: string;
  front_photo: string | null;
}
