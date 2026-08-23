import { supabase } from "@/integrations/supabase/client";
import type { SkinAnalysis } from "@/lib/skin-analysis";
import type { ScanResult } from "@/lib/skinAnalysis";
import type { Landmark } from "@/lib/facemesh";
import { overallScore, toConcernRows } from "@/lib/scan-concerns";

export interface SaveScanInput {
  photoPath: string | null;
  thumbPath?: string | null;
  storePhoto: boolean;
  landmarks: Landmark[] | null;
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

  const rows = toConcernRows(input.result);

  const { data: scan, error } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      photo_path: input.storePhoto ? input.photoPath : null,
      thumb_path: input.storePhoto ? (input.thumbPath ?? null) : null,
      store_photo: input.storePhoto,
      landmarks: input.landmarks ? (input.landmarks as unknown as never) : null,
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
    console.warn("scan insert failed", error?.message);
    return null;
  }

  const { error: resultsError } = await supabase.from("scan_results").insert(
    rows.map((r) => ({
      scan_id: scan.id,
      concern_key: r.concern_key,
      score: r.score,
      band: r.band,
      sub_scores: r.sub_scores as unknown as never,
      region_scores: r.region_scores as unknown as never,
      regions: r.regions as unknown as never,
    })),
  );
  if (resultsError) console.warn("scan results insert failed", resultsError.message);

  return scan.id;
}
