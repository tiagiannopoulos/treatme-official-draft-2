import { supabase } from "@/integrations/supabase/client";
import { AnalysisSchema, type SkinAnalysis } from "@/lib/skin-analysis";
import type { ScanResult } from "@/lib/skinAnalysis";
import type { Landmark } from "@/lib/facemesh";

export interface SavedScan {
  scanId: string;
  createdAt: string;
  photoPath: string | null;
  landmarks: Landmark[] | null;
  result: ScanResult | null;
  analysis: SkinAnalysis | null;
  medicalFlag: string | null;
  photoQuality: string | null;
}

/** loads one saved scan (the full read, not just the score) for the signed in user. */
export async function fetchSavedScan(scanId: string): Promise<SavedScan | null> {
  const { data, error } = await supabase
    .from("scans")
    .select("id, created_at, photo_path, landmarks, result, analysis, medical_flag, photo_quality")
    .eq("id", scanId)
    .maybeSingle();

  if (error || !data) return null;

  let analysis: SkinAnalysis | null = null;
  if (data.analysis) {
    const parsed = AnalysisSchema.safeParse(data.analysis);
    analysis = parsed.success ? parsed.data : null;
  }

  return {
    scanId: data.id,
    createdAt: data.created_at,
    photoPath: data.photo_path,
    landmarks: (data.landmarks as unknown as Landmark[] | null) ?? null,
    result: (data.result as unknown as ScanResult | null) ?? null,
    analysis,
    medicalFlag: data.medical_flag,
    photoQuality: data.photo_quality,
  };
}
