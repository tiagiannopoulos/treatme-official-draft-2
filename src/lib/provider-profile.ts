import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProviderMedia {
  id: string;
  treatment_slug: string;
  treatment_name: string;
  before_url: string;
  after_url: string;
  weeks_between: number | null;
}

export interface ProviderReview {
  id: string;
  reviewer_name: string;
  rating: number;
  treatment_name: string;
  body: string;
  reviewed_at: string;
}

/** before/after pairs. rls already limits this to approved + consented rows. */
export function providerMediaQuery(providerId: string) {
  return queryOptions({
    queryKey: ["provider-media", providerId],
    queryFn: async (): Promise<ProviderMedia[]> => {
      const { data, error } = await supabase
        .from("provider_media")
        .select("id, treatment_slug, treatment_name, before_url, after_url, weeks_between")
        .eq("provider_id", providerId)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as ProviderMedia[];
    },
    staleTime: 5 * 60_000,
  });
}

/** treatme reviews only, most recent first. */
export function providerReviewsQuery(providerId: string) {
  return queryOptions({
    queryKey: ["provider-reviews", providerId],
    queryFn: async (): Promise<ProviderReview[]> => {
      const { data, error } = await supabase
        .from("provider_reviews")
        .select("id, reviewer_name, rating, treatment_name, body, reviewed_at")
        .eq("provider_id", providerId)
        .order("reviewed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ ...r, rating: Number(r.rating) })) as ProviderReview[];
    },
    staleTime: 5 * 60_000,
  });
}

export function elapsedLabel(weeks: number | null): string {
  if (!weeks) return "";
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"}`;
  const months = Math.round(weeks / 4);
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function reviewDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-CA", { month: "short", year: "numeric" })
    .toLowerCase();
}
