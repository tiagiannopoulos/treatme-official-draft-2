import type { SkinAnalysis } from "@/lib/skin-analysis";
import { CONCERN_KEYS, type ConcernKey, type ConcernResult, type ScanResult } from "./types";

/** marker scores are higher = better; engine concern scores are higher = worse */
const sev = (v: number) => Math.max(0, Math.min(100, Math.round(100 - v)));

/**
 * turns one vision analysis into the engine's concern vocabulary so
 * recommendations and the results screen keep one shared shape.
 */
export function resultFromAnalysis(analysis: SkinAnalysis, scanId: string): ScanResult {
  const m = analysis.markers;

  const severity: Record<ConcernKey, number> = {
    hydration: sev(m.hydration.score),
    texture: sev(m.texture.score),
    pores: sev(m.pores.score),
    dullness: sev(m.hydration.score),
    fineLines: sev(m.fineLines.score),
    wrinkles: sev(m.wrinkles.score),
    pigmentation: sev(m.pigmentation.score),
    darkSpots: sev(m.darkSpots.score),
    redness: sev(m.redness.score),
    acne: sev(m.texture.score),
    acneScars: sev(m.texture.score),
    underEyes: sev(m.darkSpots.score),
    volumeLoss: sev(m.volumeLoss.score),
    laxity: sev(m.volumeLoss.score),
    symmetry: sev(m.symmetry.score),
  };

  const concerns: ConcernResult[] = CONCERN_KEYS.map((key) => ({
    key,
    score: severity[key],
    confidence: 0.9,
    assessable: true,
  }));

  return {
    scan_id: scanId,
    model_version: "gemini-3-flash-preview",
    image_quality: {
      ok: analysis.photoQuality !== "poor",
      issues: analysis.photoQuality === "poor" ? ["hard_to_read"] : [],
    },
    concerns,
  };
}
