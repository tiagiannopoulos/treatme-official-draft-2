import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentCategory, displayTreatmentName } from "@/lib/treatment-labels";

export const CREAM = "#FCFBF7";
export const BUBBLEGUM = "#F8A1C6";
export const HOT = "#FF1F87";
export const BUTTER = "#FFEDB4";
export const MINT = "#DFFFF8";
export const INK = "#111111";

export type StoryKind =
  | "what_it_is"
  | "who_its_for"
  | "downtime_cost"
  | "real_results"
  | "find_provider";

export interface CatalogTreatment {
  slug: string;
  name: string;
  category: string;
  family: string;
  sort_order: number;
  icon_url: string | null;
  poster_url: string | null;
  accent_color: string;
  blurb: string;
  downtime_label: string;
  avg_price_low: number | null;
  avg_price_high: number | null;
  /** true when the treatment has at least one story slide, so the story affordance can show. */
  has_story: boolean;
}

/** every treatment plus its story availability, ordered by sort_order. read only. */
export const treatmentCatalogQuery = queryOptions({
  queryKey: ["treatment-catalog"],
  queryFn: async (): Promise<CatalogTreatment[]> => {
    const [tRes, sRes] = await Promise.all([
      supabase
        .from("treatments")
        .select(
          "slug, name, category, family, sort_order, icon_url, poster_url, accent_color, blurb, downtime_label, avg_price_low, avg_price_high",
        )
        .order("sort_order", { ascending: true }),
      supabase.from("treatment_story_slides").select("treatment_slug"),
    ]);
    if (tRes.error) throw new Error(tRes.error.message);
    if (sRes.error) throw new Error(sRes.error.message);

    const withStory = new Set((sRes.data ?? []).map((r) => r.treatment_slug));

    return (tRes.data ?? []).map((t) => ({
      slug: t.slug,
      name: displayTreatmentName(t.name, t.slug),
      category: displayTreatmentCategory(t.category, t.slug),
      family: t.family ?? "",
      sort_order: t.sort_order ?? 0,
      icon_url: t.icon_url ?? null,
      poster_url: t.poster_url ?? null,
      accent_color: t.accent_color || BUBBLEGUM,
      blurb: t.blurb ?? "",
      downtime_label: t.downtime_label ?? "varies by provider",
      avg_price_low: t.avg_price_low ?? null,
      avg_price_high: t.avg_price_high ?? null,
      has_story: withStory.has(t.slug),
    }));
  },
  staleTime: 5 * 60_000,
});

export interface StorySlideRow {
  id: string;
  slide_index: number;
  kind: StoryKind;
  headline: string;
  body: string;
  image_url: string | null;
}

export const storySlidesQuery = (slug: string) =>
  queryOptions({
    queryKey: ["treatment-story", slug],
    queryFn: async (): Promise<StorySlideRow[]> => {
      const { data, error } = await supabase
        .from("treatment_story_slides")
        .select("id, slide_index, kind, headline, body, image_url")
        .eq("treatment_slug", slug)
        .order("slide_index", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: r.id,
        slide_index: r.slide_index,
        kind: r.kind as StoryKind,
        headline: r.headline ?? "",
        body: r.body ?? "",
        image_url: r.image_url ?? null,
      }));
    },
    staleTime: 5 * 60_000,
  });

export interface RealResult {
  id: string;
  before_url: string;
  after_url: string;
  weeks: number | null;
}

/** real, consented before and after pairs only. never simulated. */
export const realResultsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["treatment-real-results", slug],
    queryFn: async (): Promise<RealResult[]> => {
      const { data, error } = await supabase
        .from("provider_media")
        .select("id, before_url, after_url, weeks_between, weeks_elapsed")
        .eq("treatment_slug", slug)
        .eq("approved", true)
        .eq("consent_confirmed", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: r.id,
        before_url: r.before_url,
        after_url: r.after_url,
        weeks: r.weeks_elapsed ?? r.weeks_between ?? null,
      }));
    },
    staleTime: 5 * 60_000,
  });

/** the four category pills used above the treatments grid. */
export const CATEGORY_PILLS = ["all", "injectables", "skin", "laser", "body"] as const;
export type CategoryPill = (typeof CATEGORY_PILLS)[number];

const FAMILY_TO_PILL: Record<string, CategoryPill> = {
  injectables: "injectables",
  "skin & facials": "skin",
  resurfacing: "skin",
  "laser & light": "laser",
  "tightening & lifting": "laser",
  body: "body",
  "hair & regenerative": "body",
  wellness: "body",
};

export function pillFor(family: string): CategoryPill {
  return FAMILY_TO_PILL[family] ?? "skin";
}

export function priceRangeLabel(t: Pick<CatalogTreatment, "avg_price_low" | "avg_price_high">): string {
  const low = t.avg_price_low && t.avg_price_low > 0 ? t.avg_price_low : null;
  const high = t.avg_price_high && t.avg_price_high > 0 ? t.avg_price_high : null;
  if (!low && !high) return "varies by provider";
  if (low && high) return `$${low} to $${high}`;
  return `from $${low ?? high}`;
}
