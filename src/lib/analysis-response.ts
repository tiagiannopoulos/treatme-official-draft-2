import { AnalysisSchema, MARKER_KEYS, type SkinAnalysis } from "./skin-analysis.ts";

export class IncompleteAnalysisError extends Error {
  constructor() {
    super("the ai returned an incomplete analysis. please try again.");
    this.name = "IncompleteAnalysisError";
  }
}

/**
 * Validate both structured and JSON-fallback model responses before saving a
 * scan. Missing observations must never become default scores, skin types,
 * findings or treatment recommendations. This checks completeness, not accuracy.
 */
export function parseAnalysisResponse(
  raw: unknown,
  allowedTreatmentSlugs: ReadonlySet<string>,
): SkinAnalysis {
  const parsed = AnalysisSchema.safeParse(raw);
  if (!parsed.success) throw new IncompleteAnalysisError();

  const analysis = parsed.data;
  const hasEmptyFindings =
    MARKER_KEYS.some((key) => !analysis.markers[key].note.trim()) ||
    !analysis.blurb.trim() ||
    [...analysis.strengths, ...analysis.weaknesses].some((text) => !text.trim());

  const treatments = [...new Set(analysis.recommendedTreatments)].filter((slug) =>
    allowedTreatmentSlugs.has(slug),
  );

  if (hasEmptyFindings || treatments.length < 2) {
    throw new IncompleteAnalysisError();
  }

  return { ...analysis, recommendedTreatments: treatments };
}
