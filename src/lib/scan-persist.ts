import { supabase } from "@/integrations/supabase/client";
import type { SkinAnalysis } from "@/lib/skin-analysis";
import type { ScanResult } from "@/lib/skinAnalysis";
import type { FaceMap, MappingMethod } from "@/lib/face-zones";
import type { Measured } from "@/lib/skin-measure";
import { overallScore, toConcernRows } from "@/lib/scan-concerns";
import { markerDrawing } from "@/lib/marker-shapes";
import { indicatorKey } from "@/lib/skin-indicators";
import { logScanIssue } from "@/lib/scan-errors";

export interface SaveScanInput {
  photoPath: string | null;
  thumbPath?: string | null;
  storePhoto: boolean;
  /** layer 1 output. null when no face was detected. */
  faceMap: FaceMap | null;
  /** layers 2 and 3 output. null when the pixels could not be read. */
  measured?: Measured | null;
  result: ScanResult;
  photoQuality: string | null;
  medicalFlag: string | null;
  analysis: SkinAnalysis | null;
}

/**
 * writes one scans row plus the 16 scan_results rows.
 * guests aren't persisted — their read lives in the session.
 */
export async function saveScan(input: SaveScanInput): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;

  const rows = toConcernRows(input.result, input.measured);
  // never place markers without a detected face.
  const mappingMethod: MappingMethod = input.faceMap ? "landmarks" : "fallback_diagram";

  const { data: scan, error } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      photo_path: input.storePhoto ? input.photoPath : null,
      thumb_path: input.storePhoto ? (input.thumbPath ?? null) : null,
      store_photo: input.storePhoto,
      // scans.landmarks is the one canonical home for landmarks.
      landmarks: input.faceMap ? (input.faceMap.landmarks as unknown as never) : null,
      face_zones: input.faceMap
        ? ({
            zones: input.faceMap.zones,
            masks: input.faceMap.masks,
            bounds: input.faceMap.bounds,
            midline: input.faceMap.midline,
          } as unknown as never)
        : null,
      mapping_method: mappingMethod,
      overall_score: overallScore(rows),
      engine: input.result.model_version,
      status: "complete",
      photo_quality: input.photoQuality,
      medical_flag: input.medicalFlag,
      skin_type: input.analysis?.skinType ?? null,
      skin_tone: input.analysis?.fitzpatrick ?? null,
      result: input.result as unknown as never,
      analysis: input.analysis ? (input.analysis as unknown as never) : null,
    })
    .select("id")
    .single();

  if (error || !scan) {
    await logScanIssue({
      stage: "persist",
      reason: "scan_insert_failed",
      detail: { message: error?.message ?? "no_row" },
    });
    return null;
  }

  // the drawing is decided once, here, and stored. the pdf renders these exact
  // positions rather than recomputing them.
  const { data: indicatorRows } = await supabase
    .from("skin_indicators")
    .select("slug, accent, overlay_kind, placement_method");
  const styleFor = new Map(
    (indicatorRows ?? []).map((i) => [
      indicatorKey(i.slug),
      { accent: i.accent, kind: i.overlay_kind, placement: i.placement_method ?? "model_zone" },
    ]),
  );

  const markersFor = (concernKey: string, regions: typeof rows[number]["regions"], score: number) => {
    if (!input.faceMap) return null;
    const style = styleFor.get(concernKey);
    return markerDrawing({
      regions,
      accent: style?.accent ?? "#F8A1C6",
      overlayKind: style?.kind ?? "patches_soft",
      score,
      landmarks: input.faceMap.landmarks,
      seed: scan.id,
      placementMethod: style?.placement,
    });
  };

  const { error: resultsError } = await supabase.from("scan_results").insert(
    rows.map((r) => ({
      scan_id: scan.id,
      concern_key: r.concern_key,
      score: r.score,
      band: r.band,
      sub_scores: r.sub_scores as unknown as never,
      region_scores: r.region_scores as unknown as never,
      regions: r.regions as unknown as never,
      zone_scores: r.zone_scores as unknown as never,
      measured: r.measured as unknown as never,
      mapping_method: input.faceMap ? r.mapping_method : "fallback_diagram",
      marker_positions: markersFor(r.concern_key, r.regions, r.score) as unknown as never,
    })),
  );
  if (resultsError) {
    await logScanIssue({
      stage: "persist",
      reason: "scan_results_insert_failed",
      detail: { message: resultsError.message, rows: rows.length },
    });
  }

  return scan.id;
}
