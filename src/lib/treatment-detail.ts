import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentName } from "@/lib/treatment-labels";

export interface TreatmentFaq {
  id: string;
  question: string;
  answer: string;
}

export interface TreatmentDetail {
  slug: string;
  name: string;
  family: string;
  accent_color: string;
  price_from: number | null;
  session_minutes: number | null;
  downtime_days: number | null;
  improves: string[];
  what_it_is: string | null;
  who_its_for: string[];
  sensation: string | null;
  faqs: TreatmentFaq[];
}

/** strip every dash character from visible copy without gluing words together. */
export function noDash(input: string): string {
  return input
    .replace(/[\u2010-\u2015]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:?])/g, "$1")
    .trim()
    .toLowerCase();
}

export const treatmentDetailQuery = (slug: string) =>
  queryOptions({
    queryKey: ["treatment-detail", slug],
    queryFn: async (): Promise<TreatmentDetail | null> => {
      const [tRes, fRes] = await Promise.all([
        supabase
          .from("treatments")
          .select(
            "slug, name, family, accent_color, price_from, session_minutes, downtime_days, improves, what_it_is, who_its_for, sensation",
          )
          .eq("slug", slug)
          .maybeSingle(),
        supabase
          .from("treatment_faqs")
          .select("id, question, answer, sort_order")
          .eq("treatment_slug", slug)
          .order("sort_order", { ascending: true }),
      ]);
      if (tRes.error) throw new Error(tRes.error.message);
      if (fRes.error) throw new Error(fRes.error.message);
      const t = tRes.data;
      if (!t) return null;

      return {
        slug: t.slug,
        name: noDash(displayTreatmentName(t.name, t.slug)),
        family: t.family ? noDash(t.family.replace(/&/g, "and")) : "",
        accent_color: t.accent_color || "#F8A1C6",
        price_from: t.price_from === null ? null : Number(t.price_from),
        session_minutes: t.session_minutes ?? null,
        downtime_days: t.downtime_days ?? null,
        improves: Array.from(
          new Set((t.improves ?? []).filter(Boolean).map((v: string) => noDash(v))),
        ),

        what_it_is: t.what_it_is ? noDash(t.what_it_is) : null,
        who_its_for: (t.who_its_for ?? []).filter(Boolean).map((v: string) => noDash(v)),
        sensation: t.sensation ? noDash(t.sensation) : null,
        faqs: (fRes.data ?? []).map((f) => ({
          id: f.id,
          question: noDash(f.question),
          answer: noDash(f.answer),
        })),
      };
    },
    staleTime: 5 * 60_000,
  });
