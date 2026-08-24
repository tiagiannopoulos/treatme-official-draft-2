// client side failure log for the scan pipeline. every silent failure — model
// load, face detection, measurement — lands in scan_errors next to the
// validation failures the api already logs, so a bad scan is visible without a
// code trace.

import { supabase } from "@/integrations/supabase/client";

export type ScanStage =
  | "facemesh_load"
  | "face_detect"
  | "face_zones"
  | "measure"
  | "persist";

export interface ScanIssue {
  stage: ScanStage;
  /** short machine readable reason, e.g. "no_face_found" */
  reason: string;
  detail?: Record<string, unknown>;
}

/** logs to the console always, and to scan_errors when there is a session */
export async function logScanIssue({ stage, reason, detail }: ScanIssue): Promise<void> {
  console.warn(`scan issue · ${stage} · ${reason}`, detail ?? {});
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("scan_errors").insert({
      user_id: userId,
      stage,
      error_message: reason,
      detail: (detail ?? null) as never,
    });
    if (error) console.warn("scan issue log failed", error.message);
  } catch (e) {
    console.warn("scan issue log failed", e);
  }
}

/** fire and forget helper for call sites that cannot await */
export function reportScanIssue(issue: ScanIssue): void {
  void logScanIssue(issue);
}
