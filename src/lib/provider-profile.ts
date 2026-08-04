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

export interface ProviderResult {
  id: string;
  treatment_slug: string;
  before_url: string;
  after_url: string;
  interval_weeks: number | null;
  caption: string | null;
  sessions: number | null;
  product_used: string | null;
}

/**
 * published before and after pairs. rls also enforces published + consented,
 * the explicit filters keep the intent readable in the client.
 */
export function providerResultsQuery(providerId: string) {
  return queryOptions({
    queryKey: ["provider-results", providerId],
    queryFn: async (): Promise<ProviderResult[]> => {
      const { data, error } = await supabase
        .from("provider_results")
        .select(
          "id, treatment_slug, before_url, after_url, interval_weeks, caption, sessions, product_used",
        )
        .eq("provider_id", providerId)
        .eq("is_published", true)
        .eq("patient_consented", true)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ProviderResult[];
    },
    staleTime: 5 * 60_000,
  });
}

/** "at 6 weeks". never a dash, never a range. */
export function intervalLabel(weeks: number | null): string {
  if (!weeks) return "";
  return `at ${weeks} week${weeks === 1 ? "" : "s"}`;
}

/** first name only, for "book this with sarah". */
export function firstName(name: string): string {
  const parts = name.toLowerCase().replace(/^dr\.?\s+/, "").split(/\s+/);
  return parts[0] ?? name.toLowerCase();
}
