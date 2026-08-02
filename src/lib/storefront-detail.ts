import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getGoogleRating } from "@/lib/google-rating.functions";

export interface StorefrontPhoto {
  id: string;
  url: string;
  caption: string | null;
}

/** photos of the actual space. public read. */
export const storefrontMediaQuery = (storefrontId: string) =>
  queryOptions({
    queryKey: ["storefront-media", storefrontId],
    queryFn: async (): Promise<StorefrontPhoto[]> => {
      const { data, error } = await supabase
        .from("storefront_media")
        .select("id, url, caption, sort_order")
        .eq("storefront_id", storefrontId)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ id: r.id, url: r.url, caption: r.caption ?? null }));
    },
    staleTime: 5 * 60_000,
  });

/** fetched live on every view. the score never lands in our database. */
export const googleRatingQuery = (placeId: string | null) =>
  queryOptions({
    queryKey: ["google-rating", placeId],
    queryFn: async () => (placeId ? getGoogleRating({ data: { placeId } }) : { rating: null, count: null }),
    enabled: Boolean(placeId),
    staleTime: 10 * 60_000,
    retry: false,
  });

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const DAY_LABEL: Record<DayKey, string> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

/** no dashes in visible copy: any range separator becomes the word "to". */
export function noDash(value: string): string {
  return value
    .replace(/\s*&\s*/g, " and ")
    .replace(/(\S)\s*[-–—]\s*(\S)/g, "$1 to $2")
    .replace(/[-–—]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase();
}

export interface HoursRow {
  key: DayKey;
  label: string;
  value: string;
}

/**
 * accepts either { mon: "9 to 6" } or { monday: "..." } shapes, plus "closed".
 * unknown shapes yield no rows so the section simply hides.
 */
export function hoursRows(hours: unknown): HoursRow[] {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return [];
  const raw = hours as Record<string, unknown>;
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string" && typeof v !== "number") continue;
    lookup.set(k.trim().toLowerCase(), String(v));
  }
  const rows: HoursRow[] = [];
  for (const key of DAY_KEYS) {
    const label = DAY_LABEL[key];
    const value = lookup.get(key) ?? lookup.get(label) ?? null;
    if (value === null) continue;
    rows.push({ key, label, value: noDash(value) || "closed" });
  }
  return rows;
}

/** today's key in the local timezone, used to highlight one row in butter. */
export function todayKey(): DayKey {
  const idx = new Date().getDay();
  return DAY_KEYS[(idx + 6) % 7]!;
}
