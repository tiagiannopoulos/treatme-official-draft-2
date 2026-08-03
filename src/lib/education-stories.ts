import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { clean } from "@/lib/treatment-story";

export const MINT = "#DFFFF8";
export const BUTTER = "#FFEDB4";
export const BUBBLEGUM = "#F8A1C6";
export const CREAM = "#FCFBF7";
export const INK = "#111111";

/** the bg column is a token, never a hex, so the palette stays in one place. */
export function bgHex(token: string | null | undefined): string {
  switch ((token ?? "").trim().toLowerCase()) {
    case "mint":
      return MINT;
    case "butter":
      return BUTTER;
    case "bubblegum":
      return BUBBLEGUM;
    case "cream":
    default:
      return CREAM;
  }
}

export type EducationSlideKind = "text" | "checklist" | "pills" | "quote" | "cta";

export interface EducationStory {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  accent_color: string;
  category: string;
}

export interface EducationSlide {
  id: string;
  kind: EducationSlideKind;
  chip: string;
  chip_icon: string | null;
  headline: string;
  body: string;
  items: string[];
  pills: string[];
  bg: string;
  cta_label: string;
  cta_route: string;
  link_label: string;
}

const KINDS: EducationSlideKind[] = ["text", "checklist", "pills", "quote", "cta"];
const asKind = (k: string | null): EducationSlideKind =>
  KINDS.includes((k ?? "") as EducationSlideKind) ? ((k as EducationSlideKind) ?? "text") : "text";

export const educationStoriesQuery = queryOptions({
  queryKey: ["education-stories"],
  queryFn: async (): Promise<EducationStory[]> => {
    const { data, error } = await supabase
      .from("education_stories")
      .select("id, slug, title, subtitle, accent_color, category, published, sort_order")
      .eq("published", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      title: clean(s.title),
      subtitle: clean(s.subtitle),
      accent_color: s.accent_color ?? MINT,
      category: clean(s.category),
    }));
  },
  staleTime: 5 * 60_000,
});

export const educationStoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["education-story", slug],
    queryFn: async (): Promise<{ story: EducationStory; slides: EducationSlide[] } | null> => {
      const { data: story, error } = await supabase
        .from("education_stories")
        .select("id, slug, title, subtitle, accent_color, category")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!story) return null;

      const { data: slides, error: sErr } = await supabase
        .from("education_slides")
        .select("id, kind, chip, chip_icon, headline, body, items, pills, bg, cta_label, cta_route, link_label, sort_order")
        .eq("story_id", story.id)
        .order("sort_order", { ascending: true });
      if (sErr) throw new Error(sErr.message);

      return {
        story: {
          id: story.id,
          slug: story.slug,
          title: clean(story.title),
          subtitle: clean(story.subtitle),
          accent_color: story.accent_color ?? MINT,
          category: clean(story.category),
        },
        slides: (slides ?? []).map((s) => ({
          id: s.id,
          kind: asKind(s.kind),
          chip: clean(s.chip),
          chip_icon: s.chip_icon ?? null,
          headline: clean(s.headline),
          body: clean(s.body),
          items: ((s.items ?? []) as string[]).map(clean).filter(Boolean),
          pills: ((s.pills ?? []) as string[]).map(clean).filter(Boolean),
          bg: s.bg ?? "cream",
          cta_label: clean(s.cta_label),
          cta_route: s.cta_route ?? "",
          link_label: clean(s.link_label),
        })),
      };
    },
    staleTime: 5 * 60_000,
  });
