import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentName } from "@/lib/treatment-labels";

/**
 * story slides are generated at runtime from the treatments row and its faq rows.
 * there is no slides table to maintain: fill the columns and the story appears.
 */

export const MINT = "#DFFFF8";
export const BUTTER = "#FFEDB4";
export const BUBBLEGUM = "#F8A1C6";
export const CREAM = "#FCFBF7";
export const INK = "#111111";

/** no dashes and no ampersands anywhere in visible copy, whatever the database holds. */
export function clean(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_+/g, " ")
    .replace(/\s*&\s*/g, " and ")
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1 to $2")
    .replace(/[-–—]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase();
}

export interface StorySource {
  slug: string;
  name: string;
  what_it_is: string;
  who_its_for: string[];
  improves: string[];
  downtime_days: number | null;
  price_from: number | null;
  session_minutes: number | null;
  faqs: Array<{ question: string; answer: string }>;
}

export const storySourceQuery = (slug: string) =>
  queryOptions({
    queryKey: ["treatment-story-source", slug],
    queryFn: async (): Promise<StorySource | null> => {
      const [tRes, fRes] = await Promise.all([
        supabase
          .from("treatments")
          .select("slug, name, what_it_is, who_its_for, improves, downtime_days, price_from, session_minutes")
          .eq("slug", slug)
          .maybeSingle(),
        supabase
          .from("treatment_faqs")
          .select("question, answer, sort_order")
          .eq("treatment_slug", slug)
          .order("sort_order", { ascending: true }),
      ]);
      if (tRes.error) throw new Error(tRes.error.message);
      if (fRes.error) throw new Error(fRes.error.message);
      const t = tRes.data;
      if (!t) return null;

      return {
        slug: t.slug,
        name: clean(displayTreatmentName(t.name, t.slug)),
        what_it_is: clean(t.what_it_is),
        who_its_for: ((t.who_its_for ?? []) as string[]).map(clean).filter(Boolean),
        improves: ((t.improves ?? []) as string[]).map(clean).filter(Boolean),
        downtime_days: t.downtime_days ?? null,
        price_from: t.price_from === null ? null : Number(t.price_from),
        session_minutes: t.session_minutes ?? null,
        faqs: (fRes.data ?? []).map((f) => ({ question: clean(f.question), answer: clean(f.answer) })),
      };
    },
    staleTime: 5 * 60_000,
  });

export type StorySlide =
  | { key: string; kind: "what_it_is"; bg: string; chip: string; name: string; body: string }
  | { key: string; kind: "who_its_for"; bg: string; chip: string; items: string[]; pills: string[] }
  | {
      key: string;
      kind: "numbers";
      bg: string;
      chip: string;
      stats: Array<{ label: string; value: string }>;
    }
  | {
      key: string;
      kind: "results";
      bg: string;
      chip: string | null;
      pairs: Array<{ id: string; before_url: string; after_url: string; interval: string }>;
    }
  | { key: string; kind: "faq"; bg: string; chip: string; question: string; answer: string }
  | { key: string; kind: "ready"; bg: string; chip: string };

export interface ResultPair {
  id: string;
  before_url: string;
  after_url: string;
  weeks: number | null;
}

export function intervalLabel(weeks: number | null): string {
  if (!weeks) return "real result";
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} later`;
  const months = Math.round(weeks / 4);
  return `${months} month${months === 1 ? "" : "s"} later`;
}

/** null columns drop their slide entirely, so the progress segments always match. */
export function buildSlides(source: StorySource, media: ResultPair[]): StorySlide[] {
  const slides: StorySlide[] = [];

  if (source.what_it_is) {
    slides.push({
      key: "what-it-is",
      kind: "what_it_is",
      bg: MINT,
      chip: "what it is",
      name: source.name,
      body: source.what_it_is,
    });
  }

  if (source.who_its_for.length) {
    slides.push({
      key: "who-its-for",
      kind: "who_its_for",
      bg: BUTTER,
      chip: "who it's for",
      items: source.who_its_for.slice(0, 4),
      pills: source.improves.slice(0, 4),
    });
  }

  const stats: Array<{ label: string; value: string }> = [];
  if (source.downtime_days !== null) {
    stats.push({
      label: "downtime",
      value: `${source.downtime_days} day${source.downtime_days === 1 ? "" : "s"}`,
    });
  }
  if (source.price_from !== null) stats.push({ label: "from", value: `$${source.price_from}` });
  if (source.session_minutes !== null) {
    stats.push({ label: "session", value: `${source.session_minutes} min` });
  }
  if (stats.length) {
    slides.push({ key: "numbers", kind: "numbers", bg: BUBBLEGUM, chip: "downtime and cost", stats });
  }

  slides.push({
    key: "results",
    kind: "results",
    bg: CREAM,
    chip: media.length ? null : "real results",
    pairs: media.map((m) => ({
      id: m.id,
      before_url: m.before_url,
      after_url: m.after_url,
      interval: intervalLabel(m.weeks),
    })),
  });

  source.faqs.forEach((f, i) => {
    if (!f.question) return;
    slides.push({
      key: `faq-${i}`,
      kind: "faq",
      bg: MINT,
      chip: "people ask",
      question: f.question,
      answer: f.answer,
    });
  });

  slides.push({ key: "ready", kind: "ready", bg: BUTTER, chip: "ready when you are" });

  return slides;
}
