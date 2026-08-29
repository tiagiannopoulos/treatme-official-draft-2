import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PROVIDERS_ENABLED } from "@/lib/features";
import { displayTreatmentCategory, displayTreatmentName } from "@/lib/treatment-labels";




export interface Storefront {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  address_line: string;
  city: string;
  postcode: string;
  lat: number;
  lng: number;
  hero_image_url: string | null;
  rating: number;
  review_count: number;
  featured: boolean;
  claimed: boolean;
  google_place_id: string | null;
  /** clinic detail fields. arrays default to empty, text fields may be null. */
  cover_url: string | null;
  /** branded storefront fields. every one of these can be null on an unclaimed listing. */
  logo_url: string | null;
  brand_accent: string | null;
  website: string | null;
  price_band: string | null;
  languages: string[];
  booked_count_30d: number;
  year_opened: number | null;

  neighbourhood: string | null;
  phone: string | null;
  hours: unknown;
  parking: string | null;
  transit_note: string | null;
  accessibility: string[];
  devices: string[];
  product_lines: string[];
  peel_depths: string[];
  cancellation_policy: string | null;
  deposit_policy: string | null;
  late_policy: string | null;
  /** treatments this clinic lists, read off their own website or verified by them. */
  listed: ListedOffer[];
}

/** one treatment a clinic offers, sourced from storefront_treatments. */
export interface ListedOffer {
  slug: string;
  name: string;
  price_from: number | null;
  /** true once the clinic confirmed it. crawled rows stay false. */
  verified: boolean;
  evidence_url: string | null;
}

/** neighbourhood is encoded as the trailing segment of the slug (e.g. the-glass-house-marylebone). */
export function neighbourhood(s: Storefront): string {
  if (s.neighbourhood) return s.neighbourhood.toLowerCase();
  const nameWords = s.name.split(/\s+/).length;
  const parts = s.slug.split("-");
  const tail = parts.slice(nameWords).join(" ");
  return tail || s.city;
}

/**
 * the area line for a card. when there is no neighbourhood we say the city
 * once, never "toronto, toronto".
 */
export function areaLine(s: Storefront): string {
  const area = neighbourhood(s);
  const city = s.city.toLowerCase();
  if (!area || area === city) return city;
  return `${area}, ${city}`;
}

/**
 * street address with the trailing repeats stripped. crawled addresses arrive
 * as "211 yonge st, toronto, on m5b 2h1, canada" and then get the city bolted
 * on again by the card.
 */
export function addressLine(s: Storefront): string {
  const city = s.city.trim().toLowerCase();
  const drop = new Set([city, "canada", "on", "ontario", s.postcode.trim().toLowerCase()]);
  const parts = s.address_line
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const norm = part.toLowerCase();
    if (drop.has(norm)) continue;
    // "on m5b 2h1" style tails
    if (/^[a-z]{2}\s+[a-z]\d[a-z]\s*\d[a-z]\d$/i.test(norm)) continue;
    if (kept.some((k) => k.toLowerCase() === norm)) continue;
    kept.push(part);
  }
  const line = (kept.length ? kept.join(", ") : parts[0] ?? s.address_line).toLowerCase();
  return line.replace(/\s*,\s*$/, "");
}

/** map centre used only to frame the map before anyone has told us where they are. */
export const TORONTO_CENTROID: LatLng = { lat: 43.6532, lng: -79.3832 };

/**
 * distance measured in postgres, not the browser. returns km per storefront id
 * within the radius, nearest first.
 */
export function nearbyStorefrontsQuery(point: LatLng | null, radiusKm: number) {
  return queryOptions({
    queryKey: ["storefronts-near", point?.lat ?? null, point?.lng ?? null, radiusKm],
    enabled: Boolean(point),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Array<{ id: string; km: number }>> => {
      if (!point) return [];
      const { data, error } = await supabase.rpc("storefronts_near", {
        _lat: point.lat,
        _lng: point.lng,
        _radius_km: radiusKm,
        _limit: 400,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<{ id: string; km: number | string }>).map((r) => ({
        id: r.id,
        km: Number(r.km),
      }));
    },
  });
}




export interface ProviderTreatment {
  treatment_slug: string;
  price_from: number | null;
  is_signature: boolean;
  name: string;
  category: string;
}

export interface Provider {
  id: string;
  slug: string;
  name: string;
  title: string;
  credentials: string;
  years_experience: number;
  bio: string;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  verified: boolean;
  licensing_body: string;
  languages: string[];
  specialties: string[];
  treats: string[];
  devices: string[];
  fitzpatrick_min: number | null;
  fitzpatrick_max: number | null;
  license_verified: boolean;
  license_number: string | null;
  /** every storefront this human works at. a provider can work at more than one. */
  storefronts: Array<Storefront & { is_primary: boolean }>;

  /** instagram style profile fields. all optional on a seeded provider. */
  credential_line: string | null;
  designations: string[];
  accepting_new: boolean;

  treatments: ProviderTreatment[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface StorefrontBoundsResult {
  ids: string[];
  total: number;
  capped: boolean;
}

/** storefront ids currently visible on the map, with an exact count before the 300 pin cap. */
export function storefrontsInBoundsQuery(bounds: MapBounds | null) {
  return queryOptions({
    queryKey: [
      "storefronts-in-bounds",
      bounds?.minLat ?? null,
      bounds?.maxLat ?? null,
      bounds?.minLng ?? null,
      bounds?.maxLng ?? null,
    ],
    enabled: Boolean(bounds),
    staleTime: 60_000,
    queryFn: async (): Promise<StorefrontBoundsResult> => {
      if (!bounds) return { ids: [], total: 0, capped: false };
      const { data, error } = await supabase.rpc("storefronts_in_bounds", {
        _min_lat: bounds.minLat,
        _max_lat: bounds.maxLat,
        _min_lng: bounds.minLng,
        _max_lng: bounds.maxLng,
        _limit: 300,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ id: string; total_count: number | string }>;
      const total = rows.length ? Number(rows[0].total_count) : 0;
      return {
        ids: rows.map((row) => row.id),
        total,
        capped: total > 300,
      };
    },
  });
}


export const RADIUS_OPTIONS = [2, 5, 10, 25, 50] as const;

/** great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round((km * 1000) / 10) * 10} m`;
  return `${km.toFixed(1)} km`;
}


async function fetchDirectory(): Promise<{ providers: Provider[]; storefronts: Storefront[] }> {
  const [storefrontsRes, providersRes, linksRes, ptRes, treatmentsRes, statsRes, listedRes] = await Promise.all([
    supabase.from("storefronts").select("*").order("name"),
    supabase.from("providers").select("*").order("name"),
    supabase.from("provider_storefronts").select("provider_id, storefront_id, is_primary"),
    supabase.from("provider_treatments").select("provider_id, treatment_slug, price_from, is_signature"),
    supabase.from("treatments").select("slug, name, category"),
    // treatme ratings are derived live from the treatme reviews table, never stored.
    supabase.from("provider_rating_stats").select("provider_id, rating, review_count"),
    supabase
      .from("storefront_treatments")
      .select("storefront_id, treatment_slug, price_from, verified_by_clinic, evidence_url"),
  ]);

  const err =
    storefrontsRes.error ||
    providersRes.error ||
    linksRes.error ||
    ptRes.error ||
    treatmentsRes.error ||
    statsRes.error;
  if (err) throw new Error(err.message);

  const listedByStore = new Map<string, ListedOffer[]>();
  const catalogue = new Map(
    (treatmentsRes.data ?? []).map((t) => [t.slug, t as { slug: string; name: string; category: string }]),
  );
  for (const row of listedRes.data ?? []) {
    const list = listedByStore.get(row.storefront_id) ?? [];
    list.push({
      slug: row.treatment_slug,
      name: displayTreatmentName(
        catalogue.get(row.treatment_slug)?.name ?? row.treatment_slug.replace(/-/g, " "),
        row.treatment_slug,
      ),
      price_from: row.price_from === null ? null : Number(row.price_from),
      verified: Boolean(row.verified_by_clinic),
      evidence_url: row.evidence_url ?? null,
    });
    listedByStore.set(row.storefront_id, list);
  }

  const storefronts = ((storefrontsRes.data ?? []) as unknown as Storefront[]).map((s) => ({
    ...s,
    // brand rule: no dash characters and no ampersands in visible copy.
    name: s.name
      ? s.name.replace(/\s*&\s*/g, " and ").replace(/[\u2010-\u2015-]/g, " ").replace(/\s+/g, " ").trim()
      : s.name,
    listed: listedByStore.get(s.id) ?? [],

  }));

  const storeById = new Map(storefronts.map((s) => [s.id, s]));
  const treatmentBySlug = new Map(
    (treatmentsRes.data ?? []).map((t) => [t.slug, t as { slug: string; name: string; category: string }]),
  );
  const statsByProvider = new Map(
    ((statsRes.data ?? []) as Array<{ provider_id: string | null; rating: number | null; review_count: number | null }>)
      .filter((s): s is { provider_id: string; rating: number | null; review_count: number | null } =>
        Boolean(s.provider_id),
      )
      .map((s) => [s.provider_id, { rating: Number(s.rating ?? 0), review_count: Number(s.review_count ?? 0) }]),
  );

  const providers: Provider[] = (providersRes.data ?? []).map((p) => {
    const row = p as unknown as Omit<Provider, "storefronts" | "treatments">;
    const stats = statsByProvider.get(row.id) ?? { rating: 0, review_count: 0 };

    const shops = (linksRes.data ?? [])
      .filter((l) => l.provider_id === row.id)
      .map((l) => {
        const s = storeById.get(l.storefront_id);
        return s ? { ...s, is_primary: l.is_primary } : null;
      })
      .filter((s): s is Storefront & { is_primary: boolean } => Boolean(s))
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

    const treatments = (ptRes.data ?? [])
      .filter((t) => t.provider_id === row.id)
      .map((t) => {
        const meta = treatmentBySlug.get(t.treatment_slug);
        return {
          treatment_slug: t.treatment_slug,
          price_from: t.price_from,
          is_signature: Boolean(t.is_signature),
          name: displayTreatmentName(meta?.name ?? t.treatment_slug.replace(/-/g, " "), t.treatment_slug),
          category: displayTreatmentCategory(meta?.category ?? "", t.treatment_slug),
        };
      })

      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...row,
      rating: stats.rating,
      review_count: stats.review_count,
      storefronts: shops,
      treatments,
    };

  });

  return { providers, storefronts };
}

export const directoryQuery = queryOptions({
  queryKey: ["search-directory"],
  queryFn: fetchDirectory,
  staleTime: 5 * 60_000,
});

/** cheapest price a provider lists, for the "from $x" line. */
export function providerFromPrice(p: Provider): number | null {
  const prices = p.treatments.map((t) => t.price_from).filter((n): n is number => typeof n === "number");
  return prices.length ? Math.min(...prices) : null;
}

export function matchProvider(p: Provider, q: string): { hit: boolean; via?: string } {
  if (!q) return { hit: true };
  const needle = q.toLowerCase();
  if (p.name.toLowerCase().includes(needle)) return { hit: true };
  if (p.title.toLowerCase().includes(needle)) return { hit: true };
  const t = p.treatments.find((x) => x.name.toLowerCase().includes(needle));
  if (t) return { hit: true, via: `offers ${t.name.toLowerCase()}` };
  const s = p.storefronts.find(
    (x) => x.name.toLowerCase().includes(needle) || x.city.toLowerCase().includes(needle),
  );
  if (s) return { hit: true, via: `works at ${s.name}` };
  return { hit: false };
}

export interface SearchTreatment {
  slug: string;
  name: string;
  category: string;
  family: string;
  price_from: number | null;
  hero_image_url: string | null;
  aliases: string[];
  /** brand and colloquial names people actually type, from the treatments table. */
  search_synonyms: string[];
  /** short one-line description used in treatment result rows. */
  descriptor: string;
}

export const searchTreatmentsQuery = queryOptions({
  queryKey: ["search-treatments"],
  queryFn: async (): Promise<SearchTreatment[]> => {
    const { data, error } = await supabase
      .from("treatments")
      .select("slug, name, category, family, price_from, hero_image_url, aliases, search_synonyms, descriptor, sort_order")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({
      slug: t.slug,
      name: displayTreatmentName(t.name, t.slug),
      category: displayTreatmentCategory(t.category, t.slug),
      family: t.family ?? "",
      price_from: t.price_from === null ? null : Number(t.price_from),
      hero_image_url: t.hero_image_url ?? null,
      aliases: (t.aliases ?? []) as string[],
      search_synonyms: (t.search_synonyms ?? []) as string[],
      descriptor: t.descriptor ?? "",
    }));
  },
  staleTime: 5 * 60_000,
});


/** name first, then alias. returns the alias that matched so the ui can show "matched: morpheus8". */
export function matchTreatment(t: SearchTreatment, q: string): { hit: boolean; via?: string } {
  if (!q) return { hit: true };
  const needle = q.toLowerCase();
  if (t.name.toLowerCase().includes(needle)) return { hit: true };
  if (t.category.toLowerCase().includes(needle)) return { hit: true };
  const synonym = t.search_synonyms.find((a) => a.toLowerCase().includes(needle));
  if (synonym) return { hit: true, via: synonym.toLowerCase() };
  const alias = t.aliases.find((a) => a.toLowerCase().includes(needle));
  if (alias) return { hit: true, via: alias.toLowerCase() };
  return { hit: false };
}

/**
 * a clinic matches a treatment search when their own website lists it, even when
 * we have nobody on their roster yet. viaWebsite says the note belongs on the card.
 */
export function matchStorefrontVia(
  s: Storefront,
  q: string,
): { hit: boolean; viaWebsite: boolean; evidenceUrl: string | null } {
  if (matchStorefront(s, q)) return { hit: true, viaWebsite: false, evidenceUrl: null };
  const needle = q.trim().toLowerCase();
  if (!needle) return { hit: false, viaWebsite: false, evidenceUrl: null };
  const offer = s.listed.find(
    (o) => o.name.toLowerCase().includes(needle) || o.slug.replace(/-/g, " ").includes(needle),
  );
  if (!offer) return { hit: false, viaWebsite: false, evidenceUrl: null };
  return { hit: true, viaWebsite: !offer.verified, evidenceUrl: offer.verified ? null : offer.evidence_url };
}

export function matchStorefront(s: Storefront, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    s.name.toLowerCase().includes(needle) ||
    s.tagline.toLowerCase().includes(needle) ||
    s.city.toLowerCase().includes(needle) ||
    s.address_line.toLowerCase().includes(needle) ||
    neighbourhood(s).toLowerCase().includes(needle) ||
    s.postcode.toLowerCase().includes(needle)
  );
}
