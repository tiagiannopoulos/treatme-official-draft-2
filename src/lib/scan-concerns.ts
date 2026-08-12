// canonical 16 concerns for the skin analysis, in four groups.
// scores here are health scores: 0 = needs the most work, 100 = great.

import type { ScanResult } from "@/lib/skinAnalysis";
import type { ConcernKey as EngineKey } from "@/lib/skinAnalysis";

export const CONCERN_GROUPS = [
  {
    key: "texture",
    label: "texture and clarity",
    concerns: ["pores", "breakouts", "texture", "oiliness"],
  },
  {
    key: "tone",
    label: "tone and pigment",
    concerns: ["redness", "pigmentation", "uniformness", "radiance"],
  },
  {
    key: "aging",
    label: "aging and structure",
    concerns: ["lines", "firmness", "volume_loss", "hydration"],
  },
  {
    key: "eyes",
    label: "eye area",
    concerns: ["dark_circles", "under_eye_puffiness", "tear_trough", "eyelid_heaviness"],
  },
] as const;

export const SCAN_CONCERN_KEYS = CONCERN_GROUPS.flatMap((g) => g.concerns as readonly string[]);

export const SCAN_CONCERN_LABEL: Record<string, string> = {
  pores: "pores",
  breakouts: "breakouts",
  texture: "texture",
  oiliness: "oiliness",
  redness: "redness",
  pigmentation: "pigmentation",
  uniformness: "uniformness",
  radiance: "radiance",
  lines: "lines",
  firmness: "firmness",
  volume_loss: "volume loss",
  hydration: "hydration",
  dark_circles: "dark circles",
  under_eye_puffiness: "under eye puffiness",
  tear_trough: "tear trough",
  eyelid_heaviness: "eyelid heaviness",
};

export type Band = "great" | "good" | "average" | "focus here";

export function bandFor(score: number): Band {
  if (score >= 90) return "great";
  if (score >= 80) return "good";
  if (score >= 50) return "average";
  return "focus here";
}

/** brand tint for a band */
export function bandTint(band: Band): string {
  if (band === "great" || band === "good") return "#DFFFF8";
  if (band === "average") return "#FFEDB4";
  return "#F8A1C6";
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** severity (higher = worse) from the engine → health score */
function health(severity: number) {
  return clamp(100 - severity);
}

const avg = (...n: number[]) => n.reduce((a, b) => a + b, 0) / n.length;

export interface ScanConcernRow {
  concern_key: string;
  score: number;
  band: Band;
  sub_scores: Record<string, number> | null;
  /** per-region health score, keyed by the region keys in CONCERN_REGIONS */
  region_scores: Record<string, number> | null;
}

/**
 * turns one engine result into the 16 canonical concern rows.
 * every row is always present, so a scan always writes 16 results.
 */
export function toConcernRows(result: ScanResult): ScanConcernRow[] {
  const sev = (key: EngineKey) => result.concerns.find((c) => c.key === key)?.score ?? 0;

  const raw: Record<string, number> = {
    pores: health(sev("pores")),
    breakouts: health(sev("acne")),
    texture: health(sev("texture")),
    oiliness: health(avg(sev("pores"), sev("acne"))),
    redness: health(sev("redness")),
    pigmentation: health(sev("pigmentation")),
    uniformness: health(avg(sev("darkSpots"), sev("pigmentation"))),
    radiance: health(sev("dullness")),
    lines: health(avg(sev("fineLines"), sev("wrinkles"))),
    firmness: health(sev("laxity")),
    volume_loss: health(sev("volumeLoss")),
    hydration: health(sev("hydration")),
    dark_circles: health(sev("underEyes")),
    under_eye_puffiness: health(avg(sev("underEyes"), sev("hydration"))),
    tear_trough: health(avg(sev("underEyes"), sev("volumeLoss"))),
    eyelid_heaviness: health(avg(sev("laxity"), sev("underEyes"))),
  };

  // per-region reads, so the overlay can paint one patch heavier than another
  const regions: Record<string, Record<string, number>> = {
    redness: {
      cheeks: health(sev("redness")),
      nose: health(sev("redness") * 1.1),
      chin: health(sev("redness") * 0.8),
      forehead: health(sev("redness") * 0.7),
    },
    pores: { t_zone: health(sev("pores") * 1.15), cheeks: health(sev("pores") * 0.85) },
    oiliness: { t_zone: raw.oiliness },
    breakouts: {
      forehead: health(sev("acne") * 0.9),
      cheeks: health(sev("acne")),
      chin: health(sev("acne") * 1.1),
    },
    pigmentation: {
      cheeks: health(sev("pigmentation") * 1.1),
      forehead: health(sev("pigmentation") * 0.85),
    },
    uniformness: { full_face: raw.uniformness },
    radiance: { full_face: raw.radiance },
    hydration: { full_face: raw.hydration },
    texture: { full_face: raw.texture },
    lines: {
      forehead: health(sev("wrinkles")),
      glabellar: health(sev("wrinkles") * 1.1),
      crowsfeet: health(sev("fineLines") * 1.1),
      nasolabial: health(avg(sev("fineLines"), sev("volumeLoss"))),
      marionette: health(avg(sev("wrinkles"), sev("laxity"))),
    },
    firmness: {
      jawline: health(sev("laxity") * 1.1),
      lower_cheeks: health(sev("laxity") * 0.9),
    },
    volume_loss: { midface: raw.volume_loss },
    dark_circles: { under_eye: raw.dark_circles },
    under_eye_puffiness: { under_eye: raw.under_eye_puffiness },
    tear_trough: { tear_trough: raw.tear_trough },
    eyelid_heaviness: { upper_lid: raw.eyelid_heaviness },
  };

  return SCAN_CONCERN_KEYS.map((key) => ({
    concern_key: key,
    score: raw[key] ?? 0,
    band: bandFor(raw[key] ?? 0),
    sub_scores:
      key === "lines"
        ? { fine: health(sev("fineLines")), deep: health(sev("wrinkles")) }
        : null,
    region_scores: regions[key] ?? null,
  }));
}

/** one overall score for the scan row */
export function overallScore(rows: ScanConcernRow[]): number {
  return clamp(avg(...rows.map((r) => r.score)));
}
