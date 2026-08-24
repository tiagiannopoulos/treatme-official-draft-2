import { supabase } from "@/integrations/supabase/client";
import type { MarkerDrawing } from "@/lib/marker-shapes";

/**
 * the positions the app already drew, keyed by concern. the report renders these
 * so the page and the pdf are never two different opinions of the same face.
 */
export async function storedMarkerPositions(
  scanId: string,
): Promise<Record<string, MarkerDrawing | null>> {
  const { data } = await supabase
    .from("scan_results")
    .select("concern_key, marker_positions")
    .eq("scan_id", scanId);
  const out: Record<string, MarkerDrawing | null> = {};
  for (const row of data ?? []) {
    out[row.concern_key] = (row.marker_positions as unknown as MarkerDrawing | null) ?? null;
  }
  return out;
}
