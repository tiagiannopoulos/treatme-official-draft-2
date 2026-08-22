import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * why a treatment row is worth this patient's attention. drives which six rows
 * a clinic shows first, and the small mint tag beside them.
 */
export interface OfferSignals {
  /** slugs already in their journey. */
  journey: Set<string>;
  /** slug to the concern that makes it relevant, eg "dryness". */
  forConcern: Map<string, string>;
}

const EMPTY: OfferSignals = { journey: new Set(), forConcern: new Map() };

export const offerSignalsQuery = () =>
  queryOptions({
    queryKey: ["offer-signals"],
    queryFn: async (): Promise<OfferSignals> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) return EMPTY;

      const [journeyRes, profileRes, scanRes, indicatorRes] = await Promise.all([
        supabase.from("journey_items").select("treatment_slug").eq("user_id", uid),
        supabase.from("patient_profile").select("concerns").eq("user_id", uid).maybeSingle(),
        supabase
          .from("scans")
          .select("id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("skin_indicators").select("slug, name"),
      ]);

      const journey = new Set((journeyRes.data ?? []).map((r) => r.treatment_slug));
      const names = new Map((indicatorRes.data ?? []).map((i) => [i.slug, i.name]));

      // concerns they saved themselves come first, then the softest scores from
      // their most recent scan.
      const keys: string[] = [...(profileRes.data?.concerns ?? [])];

      if (scanRes.data?.id) {
        const { data: results } = await supabase
          .from("scan_results")
          .select("concern_key, score")
          .eq("scan_id", scanRes.data.id)
          .order("score", { ascending: true })
          .limit(3);
        for (const r of results ?? []) if (!keys.includes(r.concern_key)) keys.push(r.concern_key);
      }

      const forConcern = new Map<string, string>();
      if (keys.length > 0) {
        const { data: links } = await supabase
          .from("concern_treatments")
          .select("concern_key, treatment_slug, strength")
          .in("concern_key", keys)
          .order("strength", { ascending: false });
        for (const link of links ?? []) {
          if (forConcern.has(link.treatment_slug)) continue;
          forConcern.set(link.treatment_slug, names.get(link.concern_key) ?? link.concern_key.replace(/_/g, " "));
        }
      }

      return { journey, forConcern };
    },
    staleTime: 60_000,
  });
