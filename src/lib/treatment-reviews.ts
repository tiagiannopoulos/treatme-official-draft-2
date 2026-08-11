import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { noDash } from "@/lib/treatment-detail";

export interface TreatmentReview {
  id: string;
  reviewer_name: string;
  rating: number;
  body: string;
  reviewed_at: string;
  provider_id: string;
  before_url: string | null;
  after_url: string | null;
}

/** reviews for one treatment, always tied to the provider who performed it. */
export const treatmentReviewsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["treatment-reviews", slug],
    queryFn: async (): Promise<TreatmentReview[]> => {
      const tRes = await supabase
        .from("treatments")
        .select("name")
        .eq("slug", slug)
        .maybeSingle();
      if (tRes.error) throw new Error(tRes.error.message);
      const name = tRes.data?.name;
      if (!name) return [];

      const [rRes, mRes] = await Promise.all([
        supabase
          .from("provider_reviews")
          .select("id, reviewer_name, rating, body, reviewed_at, provider_id")
          .eq("published", true)
          .ilike("treatment_name", name)
          .order("reviewed_at", { ascending: false }),
        supabase
          .from("provider_results")
          .select("provider_id, before_url, after_url, sort_order")
          .eq("treatment_slug", slug)
          .eq("is_published", true)
          .eq("patient_consented", true)
          .order("sort_order"),
      ]);
      if (rRes.error) throw new Error(rRes.error.message);
      if (mRes.error) throw new Error(mRes.error.message);

      const pairs = new Map<string, { before_url: string; after_url: string }>();
      for (const m of mRes.data ?? []) {
        if (!pairs.has(m.provider_id)) {
          pairs.set(m.provider_id, { before_url: m.before_url, after_url: m.after_url });
        }
      }

      return (rRes.data ?? []).map((r) => {
        const pair = pairs.get(r.provider_id);
        return {
          id: r.id,
          reviewer_name: noDash(r.reviewer_name),
          rating: Number(r.rating),
          body: noDash(r.body),
          reviewed_at: r.reviewed_at,
          provider_id: r.provider_id,
          before_url: pair?.before_url ?? null,
          after_url: pair?.after_url ?? null,
        };
      });
    },
    staleTime: 5 * 60_000,
  });
