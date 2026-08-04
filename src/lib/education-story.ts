import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { clean } from "@/lib/treatment-story";

export const EDU_SLUGS = [
  "skin-structure",
  "skin-concerns",
  "treatment-types",
  "health-vs-structure",
  "choosing-a-provider",
  "before-and-afters",
  "skin-tone-and-treatment",
  "what-things-cost",
  "your-first-appointment",
] as const;

export const BG_HEX: Record<string, string> = {
  mint: "#DFFFF8",
  butter: "#FFEDB4",
  bubblegum: "#F8A1C6",
  cream: "#FCFBF7",
};

export function bgHex(bg: string | null): string {
  if (!bg) return BG_HEX.cream;
  const key = bg.replace(/_scrim$/, "").toLowerCase();
  return BG_HEX[key] ?? (bg.startsWith("#") ? bg : BG_HEX.cream);
}

export interface EduStory {
  slug: string;
  title: string;
  subtitle: string;
  accent: string;
  sort_order: number;
}

export interface EduSlide {
  id: string;
  kind: "text" | "checklist" | "pills" | "quote" | "cta";
  chip_label: string;
  chip_icon: string | null;
  headline: string;
  body: string;
  items: string[];
  pills: string[];
  bg: string;
  cta_label: string;
  cta_route: string;
}

export const eduStoriesQuery = queryOptions({
  queryKey: ["education-stories"],
  queryFn: async (): Promise<EduStory[]> => {
    const { data, error } = await supabase
      .from("education_stories")
      .select("slug, title, subtitle, accent, sort_order")
      .in("slug", EDU_SLUGS as unknown as string[])
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({
      slug: s.slug,
      title: clean(s.title),
      subtitle: clean(s.subtitle),
      accent: s.accent ?? "mint",
      sort_order: s.sort_order,
    }));
  },
  staleTime: 5 * 60_000,
});

const KINDS = new Set(["text", "checklist", "pills", "quote", "cta"]);

export const eduSlidesQuery = (slug: string) =>
  queryOptions({
    queryKey: ["education-slides", slug],
    queryFn: async (): Promise<EduSlide[]> => {
      const { data, error } = await supabase
        .from("education_slides")
        .select("id, kind, chip_label, chip_icon, headline, body, items, pills, bg, cta_label, cta_route, sort_order")
        .eq("story_slug", slug)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((s) => ({
        id: s.id,
        kind: (KINDS.has(s.kind ?? "") ? s.kind : "text") as EduSlide["kind"],
        chip_label: clean(s.chip_label),
        chip_icon: s.chip_icon ?? null,
        headline: clean(s.headline),
        body: clean(s.body),
        items: ((s.items ?? []) as string[]).map(clean).filter(Boolean),
        pills: ((s.pills ?? []) as string[]).map(clean).filter(Boolean),
        bg: bgHex(s.bg),
        cta_label: clean(s.cta_label),
        cta_route: s.cta_route ?? "/treatments",
      }));
    },
    staleTime: 5 * 60_000,
  });
