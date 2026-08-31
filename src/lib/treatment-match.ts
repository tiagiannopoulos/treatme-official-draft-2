import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { noDash } from "@/lib/treatment-detail";
import { distanceKm, type LatLng } from "@/lib/search-data";
import type { Budget } from "@/lib/patient-store";

/**
 * matching for the "matched for you" screen. this is a supabase read, never a
 * model call. rank order is fixed: offers the treatment (required), then
 * overlap with the patient's lowest scoring concerns, then distance from their
 * city, then fit against their stated budget, then verified review count.
 */

export interface MatchProvider {
  id: string;
  name: string;
  specialty: string;
  clinicId: string;
  clinicName: string;
  neighbourhood: string;
  avatarUrl: string | null;
  /** native treatme rating, only when there are 3 or more verified reviews */
  rating: number | null;
  verifiedReviews: number;
  why: string;
}

export interface MatchClinic {
  id: string;
  name: string;
  neighbourhood: string;
  distanceKm: number | null;
  priceFrom: number | null;
  claimed: boolean;
}

export interface TreatmentMatch {
  treatmentName: string;
  treatmentPriceFrom: number | null;
  providers: MatchProvider[];
  clinics: MatchClinic[];
}

export const BUDGET_CEILING: Record<Budget, number> = {
  "under $300": 300,
  "$300 to $800": 800,
  "$800 to $1500": 1500,
  "$1500 plus": Number.POSITIVE_INFINITY,
};

export interface MatchInput {
  /** the patient's lowest scoring concerns, worst first, in ui words */
  concerns: string[];
  /** null when we do not know where the patient is. distances stay hidden then. */
  center: LatLng | null;
  radiusKm: number;
  budget: Budget | null;
}

const MIN_REVIEWS_FOR_RATING = 3;

function concernWeight(index: number) {
  if (index === 0) return 3;
  if (index === 1) return 2;
  return 1;
}

export const treatmentMatchQuery = (slug: string, input: MatchInput) =>
  queryOptions({
    queryKey: [
      "treatment-match",
      slug,
      input.concerns.join(","),
      input.center ? Math.round(input.center.lat * 1000) : "nowhere",
      input.center ? Math.round(input.center.lng * 1000) : "nowhere",
      input.radiusKm,
      input.budget,
    ],
    queryFn: () => fetchMatch(slug, input),
    staleTime: 5 * 60_000,
  });

async function fetchMatch(slug: string, input: MatchInput): Promise<TreatmentMatch | null> {
  const [tRes, ptRes, listedRes] = await Promise.all([
    supabase.from("treatments").select("slug, name, price_from").eq("slug", slug).maybeSingle(),
    supabase
      .from("provider_treatments")
      .select("provider_id, price_from")
      .eq("treatment_slug", slug),
    supabase
      .from("storefront_treatments")
      .select("storefront_id, price_from")
      .eq("treatment_slug", slug),
  ]);
  if (tRes.error) throw new Error(tRes.error.message);
  if (ptRes.error) throw new Error(ptRes.error.message);
  if (listedRes.error) throw new Error(listedRes.error.message);
  const treatment = tRes.data;
  if (!treatment) return null;

  const treatmentName = noDash(displayTreatmentName(treatment.name, treatment.slug));
  const treatmentPriceFrom = treatment.price_from === null ? null : Number(treatment.price_from);

  const offers = ptRes.data ?? [];
  const providerIds = Array.from(new Set(offers.map((o) => o.provider_id)));
  const listedOffers = listedRes.data ?? [];
  const listedStorefrontIds = Array.from(new Set(listedOffers.map((o) => o.storefront_id)));
  const listedStoresRes = listedStorefrontIds.length
    ? await supabase
        .from("storefronts")
        .select("id, name, neighbourhood, city, lat, lng, claimed")
        .in("id", listedStorefrontIds)
    : { data: [], error: null as null | { message: string } };
  if (listedStoresRes.error) throw new Error(listedStoresRes.error.message);

  const listedPrice = new Map(
    listedOffers.map((offer) => [
      offer.storefront_id,
      offer.price_from === null ? null : Number(offer.price_from),
    ]),
  );
  const listedClinics: MatchClinic[] = (listedStoresRes.data ?? [])
    .map((shop) => {
      const km = input.center
        ? distanceKm(input.center, { lat: shop.lat, lng: shop.lng })
        : null;
      return {
        id: shop.id,
        name: shop.name.toLowerCase(),
        neighbourhood: (shop.neighbourhood ?? shop.city).toLowerCase(),
        distanceKm: km,
        priceFrom: listedPrice.get(shop.id) ?? treatmentPriceFrom,
        claimed: shop.claimed,
      };
    })
    .filter((clinic) => clinic.distanceKm === null || clinic.distanceKm <= input.radiusKm)
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  if (!providerIds.length) {
    return { treatmentName, treatmentPriceFrom, providers: [], clinics: listedClinics.slice(0, 3) };
  }

  const priceByProvider = new Map<string, number | null>();
  for (const o of offers) {
    priceByProvider.set(o.provider_id, o.price_from === null ? null : Number(o.price_from));
  }

  const [pRes, linkRes, revRes] = await Promise.all([
    supabase
      .from("providers")
      .select("id, name, title, specialties, treats, avatar_url, verified")
      .in("id", providerIds),
    supabase
      .from("provider_storefronts")
      .select("provider_id, storefront_id, is_primary")
      .in("provider_id", providerIds),
    supabase
      .from("provider_reviews")
      .select("provider_id, rating")
      .eq("published", true)
      .in("provider_id", providerIds),
  ]);
  if (pRes.error) throw new Error(pRes.error.message);
  if (linkRes.error) throw new Error(linkRes.error.message);
  if (revRes.error) throw new Error(revRes.error.message);

  const storefrontIds = Array.from(new Set((linkRes.data ?? []).map((l) => l.storefront_id)));
  const sRes = storefrontIds.length
    ? await supabase
        .from("storefronts")
        .select("id, name, neighbourhood, city, slug, lat, lng, claimed")
        .in("id", storefrontIds)
    : { data: [], error: null as null | { message: string } };
  if (sRes.error) throw new Error(sRes.error.message);

  type Shop = {
    id: string;
    name: string;
    neighbourhood: string | null;
    city: string;
    lat: number;
    lng: number;
    claimed: boolean;
  };
  const shops = new Map<string, Shop>();
  for (const s of (sRes.data ?? []) as Shop[]) shops.set(s.id, s);

  const reviewsByProvider = new Map<string, { count: number; sum: number }>();
  for (const r of revRes.data ?? []) {
    const agg = reviewsByProvider.get(r.provider_id) ?? { count: 0, sum: 0 };
    agg.count += 1;
    agg.sum += Number(r.rating ?? 0);
    reviewsByProvider.set(r.provider_id, agg);
  }

  const budgetCeiling = input.budget ? BUDGET_CEILING[input.budget] : Number.POSITIVE_INFINITY;
  const concerns = input.concerns.map((c) => c.toLowerCase());

  const scored = (
    (pRes.data ?? []) as Array<{
      id: string;
      name: string;
      title: string | null;
      specialties: string[] | null;
      treats: string[] | null;
      avatar_url: string | null;
      verified: boolean;
    }>
  ).map((p) => {
    const treats = [...(p.treats ?? []), ...(p.specialties ?? [])].map((v) => v.toLowerCase());
    const matchedConcerns = concerns.filter((c) =>
      treats.some((t) => t.includes(c) || c.includes(t)),
    );
    const overlap = matchedConcerns.reduce((sum, c) => sum + concernWeight(concerns.indexOf(c)), 0);

    const links = (linkRes.data ?? []).filter((l) => l.provider_id === p.id);
    let best: { shop: Shop; km: number } | null = null;
    for (const l of links) {
      const shop = shops.get(l.storefront_id);
      if (!shop) continue;
      const km = input.center
        ? distanceKm(input.center, { lat: shop.lat, lng: shop.lng })
        : Number.POSITIVE_INFINITY;
      if (!best || km < best.km || (km === best.km && l.is_primary)) best = { shop, km };
    }

    const price = priceByProvider.get(p.id) ?? treatmentPriceFrom;
    const inBudget = price === null ? true : price <= budgetCeiling;
    const agg = reviewsByProvider.get(p.id) ?? { count: 0, sum: 0 };
    const verifiedReviews = agg.count;
    const rating =
      verifiedReviews >= MIN_REVIEWS_FOR_RATING
        ? Number((agg.sum / verifiedReviews).toFixed(1))
        : null;

    const km = best?.km ?? Number.POSITIVE_INFINITY;
    const nearScore = Number.isFinite(km) ? Math.max(0, input.radiusKm * 2 - km) : 0;
    const rank =
      overlap * 1000 + nearScore * 10 + (inBudget ? 60 : 0) + Math.min(verifiedReviews, 20);

    const whyBits: string[] = [];
    if (matchedConcerns.length) {
      whyBits.push(`treats ${matchedConcerns.slice(0, 2).join(" and ")}`);
    } else {
      whyBits.push(`offers ${treatmentName}`);
    }
    if (verifiedReviews) {
      whyBits.push(`${verifiedReviews} verified review${verifiedReviews === 1 ? "" : "s"}`);
    } else if (p.verified) {
      whyBits.push("licence verified by treatme");
    }

    return {
      rank,
      km,
      provider: {
        id: p.id,
        name: p.name.toLowerCase(),
        specialty: (p.title ?? (p.specialties ?? [])[0] ?? "aesthetics provider").toLowerCase(),
        clinicId: best?.shop.id ?? "",
        clinicName: (best?.shop.name ?? "").toLowerCase(),
        neighbourhood: (best?.shop.neighbourhood ?? best?.shop.city ?? "").toLowerCase(),
        avatarUrl: p.avatar_url,
        rating,
        verifiedReviews,
        why: whyBits.join(", "),
      } satisfies MatchProvider,
    };
  });

  const providers = scored
    .filter((s) => s.provider.clinicId)
    .sort((a, b) => b.rank - a.rank || a.km - b.km)
    .slice(0, 3)
    .map((s) => s.provider);

  // clinics: every storefront where a matching provider works, nearest first
  const clinicRank = new Map<string, { shop: Shop; price: number | null; km: number }>();
  for (const l of linkRes.data ?? []) {
    const shop = shops.get(l.storefront_id);
    if (!shop) continue;
    const price = priceByProvider.get(l.provider_id) ?? treatmentPriceFrom;
    const existing = clinicRank.get(shop.id);
    const km = input.center
      ? distanceKm(input.center, { lat: shop.lat, lng: shop.lng })
      : Number.POSITIVE_INFINITY;
    if (!existing) {
      clinicRank.set(shop.id, { shop, price, km });
    } else if (price !== null && (existing.price === null || price < existing.price)) {
      existing.price = price;
    }
  }

  const providerClinics: MatchClinic[] = Array.from(clinicRank.values())
    .filter((clinic) => !input.center || clinic.km <= input.radiusKm)
    .sort((a, b) => {
      const aFits = a.price === null || a.price <= budgetCeiling ? 0 : 1;
      const bFits = b.price === null || b.price <= budgetCeiling ? 0 : 1;
      if (aFits !== bFits) return aFits - bFits;
      return a.km - b.km;
    })
    .slice(0, 3)
    .map((c) => ({
      id: c.shop.id,
      name: c.shop.name.toLowerCase(),
      neighbourhood: (c.shop.neighbourhood ?? c.shop.city).toLowerCase(),
      distanceKm: Number.isFinite(c.km) ? c.km : null,
      priceFrom: c.price,
      claimed: c.shop.claimed,
    }));

  const clinicsById = new Map<string, MatchClinic>();
  for (const clinic of [...listedClinics, ...providerClinics]) {
    const existing = clinicsById.get(clinic.id);
    if (!existing) {
      clinicsById.set(clinic.id, clinic);
    } else if (
      clinic.priceFrom !== null &&
      (existing.priceFrom === null || clinic.priceFrom < existing.priceFrom)
    ) {
      existing.priceFrom = clinic.priceFrom;
    }
  }
  const clinics = [...clinicsById.values()]
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, 3);

  return { treatmentName, treatmentPriceFrom, providers, clinics };
}

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

/** one sentence explaining the match, e.g. "three providers who treat redness, within 10km, in your budget." */
export function matchSubline(
  providerCount: number,
  topConcern: string | null,
  radiusKm: number,
  budget: Budget | null,
  treatmentName: string,
): string {
  const count = COUNT_WORDS[providerCount] ?? String(providerCount);
  const who = topConcern ? `who treat ${topConcern}` : `who do ${treatmentName}`;
  const bits = [
    `${count} provider${providerCount === 1 ? "" : "s"} ${who}`,
    `within ${radiusKm}km`,
  ];
  if (budget) bits.push("in your budget");
  return `${bits.join(", ")}.`;
}
