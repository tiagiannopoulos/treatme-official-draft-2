import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentCategory, displayTreatmentName } from "@/lib/treatment-labels";

/**
 * what a clinic offers according to the clinic's own website, plus anything the
 * clinic has verified itself. confidence is ours, never a patient's business.
 */
export interface ListedTreatment {
  slug: string;
  name: string;
  family: string;
  from: number | null;
  /** true once the clinic confirmed it. crawled rows stay false. */
  verified: boolean;
  /** the page on their site that named this treatment. */
  evidenceUrl: string | null;
}

export const storefrontTreatmentsQuery = (storefrontId: string) =>
  queryOptions({
    queryKey: ["storefront-treatments", storefrontId],
    queryFn: async (): Promise<ListedTreatment[]> => {
      const [listed, catalog] = await Promise.all([
        supabase
          .from("storefront_treatments")
          .select("treatment_slug, source, price_from, evidence_url, verified_by_clinic")
          .eq("storefront_id", storefrontId),
        supabase.from("treatments").select("slug, name, category"),
      ]);
      if (listed.error) throw new Error(listed.error.message);
      if (catalog.error) throw new Error(catalog.error.message);

      const meta = new Map((catalog.data ?? []).map((t) => [t.slug, t]));
      return (listed.data ?? [])
        .map((row) => {
          const t = meta.get(row.treatment_slug);
          return {
            slug: row.treatment_slug,
            name: displayTreatmentName(t?.name ?? row.treatment_slug.replace(/-/g, " "), row.treatment_slug),
            family: displayTreatmentCategory(t?.category ?? "", row.treatment_slug) || "treatments",
            from: row.price_from === null ? null : Number(row.price_from),
            verified: Boolean(row.verified_by_clinic),
            evidenceUrl: row.verified_by_clinic ? null : (row.evidence_url ?? null),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60_000,
  });
