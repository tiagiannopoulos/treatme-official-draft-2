import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { noDash } from "@/lib/storefront-detail";

export interface ClinicBundle {
  id: string;
  name: string;
  tagline: string | null;
  treatmentSlugs: string[];
  sessions: number | null;
  price: number | null;
  compareAtPrice: number | null;
  validityMonths: number | null;
  badge: string | null;
  /** dollars saved against the compare price, null when there is nothing to compare. */
  saves: number | null;
}

/** bundles a clinic sells. public read is limited to active rows by policy. */
export const clinicBundlesQuery = (storefrontId: string) =>
  queryOptions({
    queryKey: ["clinic-bundles", storefrontId],
    queryFn: async (): Promise<ClinicBundle[]> => {
      const { data, error } = await supabase
        .from("clinic_bundles")
        .select(
          "id, name, tagline, treatment_slugs, sessions, price, compare_at_price, validity_months, badge, sort_order",
        )
        .eq("storefront_id", storefrontId)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => {
        const price = r.price === null ? null : Number(r.price);
        const compare = r.compare_at_price === null ? null : Number(r.compare_at_price);
        return {
          id: r.id,
          name: noDash(r.name),
          tagline: r.tagline ? noDash(r.tagline) : null,
          treatmentSlugs: (r.treatment_slugs ?? []).filter(Boolean),
          sessions: r.sessions ?? null,
          price,
          compareAtPrice: compare,
          validityMonths: r.validity_months ?? null,
          badge: r.badge ? noDash(r.badge) : null,
          saves: price !== null && compare !== null && compare > price ? Math.round(compare - price) : null,
        };
      });
    },
    staleTime: 5 * 60_000,
  });
