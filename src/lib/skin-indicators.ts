import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** the 18 indicators and how each one draws. always read, never hardcoded. */
export interface SkinIndicator {
  slug: string;
  name: string;
  overlayKind: string;
  accent: string;
  region: string;
  sortOrder: number;
  whatItMeans: string;
  whatHelps: string[];
  /** pixel, geometry or model_zone. drives the line under the photo. */
  placementMethod: string;
}

interface Row {
  slug: string;
  name: string;
  overlay_kind: string;
  accent: string;
  region: string;
  sort_order: number;
  what_it_means: string | null;
  what_helps: string[] | null;
  placement_method: string | null;
}

export async function fetchSkinIndicators(): Promise<SkinIndicator[]> {
  const { data, error } = await supabase
    .from("skin_indicators")
    .select("slug, name, overlay_kind, accent, region, sort_order, what_it_means, what_helps, placement_method")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    slug: r.slug,
    name: r.name,
    overlayKind: r.overlay_kind,
    accent: r.accent,
    region: r.region,
    sortOrder: r.sort_order,
    whatItMeans: r.what_it_means ?? "",
    whatHelps: r.what_helps ?? [],
    placementMethod: r.placement_method ?? "model_zone",
  }));
}

export const skinIndicatorsQuery = () =>
  queryOptions({
    queryKey: ["skin-indicators"],
    queryFn: fetchSkinIndicators,
    staleTime: 30 * 60 * 1000,
  });

/** the scan stores concern keys with underscores, the table uses hyphens */
export function indicatorKey(slug: string): string {
  return slug.replace(/-/g, "_");
}

export function findIndicator(list: SkinIndicator[], key: string): SkinIndicator | undefined {
  const wanted = indicatorKey(key);
  return list.find((i) => indicatorKey(i.slug) === wanted);
}
