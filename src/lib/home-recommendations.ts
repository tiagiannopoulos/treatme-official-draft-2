import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { topConcerns, type ScanResult } from "@/lib/skinAnalysis";
import { getRecommendations, type Recommendation } from "@/lib/recommendations";

export interface ScanPick {
  scanId: string;
  treatments: Recommendation[];
}

/**
 * the signed in patient's latest scan turned into the treatments their skin
 * asked for. drives the menu rail once a scan exists.
 */
export const scanPicksQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["home-scan-picks", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ScanPick | null> => {
      const { data, error } = await supabase
        .from("scans")
        .select("id, result")
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data?.result) return null;

      const result = data.result as unknown as ScanResult;
      const { scanDriven } = await getRecommendations(topConcerns(result), []);
      return { scanId: data.id, treatments: scanDriven };
    },
  });
