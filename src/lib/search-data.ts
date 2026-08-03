import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
}

/** neighbourhood is encoded as the trailing segment of the slug (e.g. the-glass-house-marylebone). */
export function neighbourhood(s: Storefront): string {
  if (s.neighbourhood) return s.neighbourhood.toLowerCase();
  const nameWords = s.name.split(/\s+/).length;
  const parts = s.slug.split("-");
  const tail = parts.slice(nameWords).join(" ");
  return tail || s.city;
}

/** hardcoded home centroid used to order nearby providers before gps. */
export const TORONTO_CENTROID: LatLng = { lat: 43.6532, lng: -79.3832 };


export interface ProviderTreatment {
  treatment_slug: string;
  price_from: number | null;
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

  treatments: ProviderTreatment[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** manual location presets so a patient can search without granting gps. greater toronto area. */
export const LOCATION_PRESETS: Array<{ label: string; point: LatLng }> = [
  { label: "downtown toronto", point: TORONTO_CENTROID },
  { label: "yorkville", point: { lat: 43.6709, lng: -79.3933 } },
  { label: "queen west", point: { lat: 43.6465, lng: -79.4025 } },
  { label: "north york", point: { lat: 43.7615, lng: -79.4111 } },
  { label: "etobicoke", point: { lat: 43.6205, lng: -79.5132 } },
  { label: "scarborough", point: { lat: 43.7764, lng: -79.2318 } },
  { label: "mississauga", point: { lat: 43.589, lng: -79.6441 } },
  { label: "vaughan", point: { lat: 43.8361, lng: -79.4983 } },
];

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
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

async function fetchDirectory(): Promise<{ providers: Provider[]; storefronts: Storefront[] }> {
  const [storefrontsRes, providersRes, linksRes, ptRes, treatmentsRes, statsRes] = await Promise.all([
    supabase.from("storefronts").select("*").order("name"),
    supabase.from("providers").select("*").order("name"),
    supabase.from("provider_storefronts").select("provider_id, storefront_id, is_primary"),
    supabase.from("provider_treatments").select("provider_id, treatment_slug, price_from"),
    supabase.from("treatments").select("slug, name, category"),
    // treatme ratings are derived live from the treatme reviews table, never stored.
    supabase.from("provider_rating_stats").select("provider_id, rating, review_count"),
  ]);

  const err =
    storefrontsRes.error ||
    providersRes.error ||
    linksRes.error ||
    ptRes.error ||
    treatmentsRes.error ||
    statsRes.error;
  if (err) throw new Error(err.message);

  const storefronts = ((storefrontsRes.data ?? []) as unknown as Storefront[]).map((s) => ({
    ...s,
    // brand rule: no dash characters and no ampersands in visible copy.
    name: s.name
      ? s.name.replace(/\s*&\s*/g, " and ").replace(/[\u2010-\u2015-]/g, " ").replace(/\s+/g, " ").trim()
      : s.name,

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
