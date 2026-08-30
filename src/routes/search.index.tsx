import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search as SearchIcon,
  X,
  MapPin,
  Star,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Sparkles,
  Droplet,
  Sun,
  Waves,
  CircleDot,
  Heart,
} from "lucide-react";

import {
  directoryQuery,
  searchTreatmentsQuery,
  distanceKm,
  formatDistance,
  matchProvider,
  matchTreatment,
  matchStorefront,
  matchStorefrontVia,
  providerFromPrice,
  nearbyStorefrontsQuery,
  storefrontsInBoundsQuery,
  neighbourhood,
  areaLine,
  addressLine,
  TORONTO_CENTROID,
  RADIUS_OPTIONS,
  type LatLng,
  type MapBounds,
  type Provider,
  type Storefront,
  type SearchTreatment,
} from "@/lib/search-data";
import { SearchMap } from "@/components/treatme/SearchMap";
import { Avatar, ProviderCardCompact } from "@/components/treatme/ProviderCard";
import { usePatient } from "@/lib/patient-store";
import { usePatientLocation } from "@/lib/patient-location";
import { LocationCard, LocationChip } from "@/components/treatme/LocationCard";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const FITZ_NUMBER: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

export const Route = createFileRoute("/search/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
    /** a treatment slug. when set, results are only clinics that list it. */
    treatment: typeof search.treatment === "string" ? search.treatment : undefined,
  }),
  head: () => ({
    meta: [
      { title: "find a clinic · treatme" },
      {
        name: "description",
        content:
          "search clinics near you by the treatment you want, and see what each one lists on their own site.",
      },
      { property: "og:title", content: "find a clinic · treatme" },
      {
        property: "og:description",
        content:
          "search clinics near you by the treatment you want, and see what each one lists on their own site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery);
    context.queryClient.ensureQueryData(searchTreatmentsQuery);
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <p className="brand-eyebrow">something broke</p>
      <h1 className="brand-display text-[28px] mt-2">couldn't load providers.</h1>
      <p className="text-[13px] text-ink-mute mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10">nothing here.</div>,
  component: SearchPage,
});


/** browse-by-category cards. each links into the treatment library filtered to its families. */
const BROWSE_CATEGORIES = [
  { label: "skin health", family: "skin & facials,resurfacing", icon: Sparkles, tile: "bg-bubblegum" },
  { label: "injectables", family: "injectables", icon: Droplet, tile: "bg-mint" },
  { label: "laser & light", family: "laser & light,tightening & lifting", icon: Sun, tile: "bg-butter" },
  { label: "body contouring", family: "body", icon: Waves, tile: "bg-bubblegum" },
  { label: "hair & scalp", family: "hair & regenerative", icon: CircleDot, tile: "bg-mint" },
  { label: "wellness", family: "wellness", icon: Heart, tile: "bg-butter" },
] as const;

function SearchPage() {
  const { data } = useSuspenseQuery(directoryQuery);
  const { data: treatments } = useSuspenseQuery(searchTreatmentsQuery);
  const patient = usePatient();

  const { q: initialQ = "", treatment: treatmentSlug } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQ);
  const [focused, setFocused] = useState(false);
  const [radius, setRadius] = useState<number>(10);
  const { location, ready: locationReady } = usePatientLocation();
  const [pickingLocation, setPickingLocation] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mapInteracted, setMapInteracted] = useState(false);

  /** map framing only. distances never come from this. */
  const center: LatLng = location ? { lat: location.lat, lng: location.lng } : TORONTO_CENTROID;
  const locLabel = location?.label ?? "your area";

  /** distance is computed in postgres, per storefront id. */
  const { data: near } = useQuery(nearbyStorefrontsQuery(location ? center : null, radius));
  const kmById = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of near ?? []) m.set(row.id, row.km);
    return m;
  }, [near]);
  const { data: visibleMapData } = useQuery(storefrontsInBoundsQuery(mapInteracted ? mapBounds : null));
  const visibleMapStorefronts = useMemo(() => {
    if (!mapInteracted || !visibleMapData) return null;
    const ids = new Set(visibleMapData.ids);
    return data.storefronts.filter((storefront) => ids.has(storefront.id));
  }, [data.storefronts, mapInteracted, visibleMapData]);

  const inputRef = useRef<HTMLInputElement>(null);

  /** debounced query: matching waits 250ms behind typing. */
  const [dq, setDq] = useState(initialQ);
  useEffect(() => {
    const id = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  const searching = q.trim().length > 0;
  const needle = dq.trim();
  /** typing ahead of the debounce -> show skeletons, never a spinner. */
  const pending = searching && q.trim() !== needle;

  /**
   * with a location: only what postgres returned, ordered by its distance.
   * without one: everything, alphabetical, and no distance is shown anywhere.
   */
  const storefrontsInRange = useMemo(() => {
    if (!location) return data.storefronts.map((s) => ({ ...s, km: null as number | null }));
    return data.storefronts
      .filter((s) => kmById.has(s.id))
      .map((s) => ({ ...s, km: kmById.get(s.id) as number | null }))
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [data.storefronts, location, kmById]);

  /** the treatment this search is pinned to, when someone arrived from a story,
   * a scan result or a quick sheet. */
  const filterTreatment = useMemo(
    () => (treatmentSlug ? (treatments.find((t) => t.slug === treatmentSlug) ?? null) : null),
    [treatments, treatmentSlug],
  );

  /**
   * clinics that actually have a storefront_treatments row for this slug, nearest
   * first. never a fallback to everything nearby: an empty answer is honest.
   */
  const offeringClinics = useMemo(() => {
    if (!treatmentSlug) return [];
    return storefrontsInRange.flatMap((s) => {
      const offer = s.listed.find((o) => o.slug === treatmentSlug);
      return offer ? [{ s, offer }] : [];
    });
  }, [storefrontsInRange, treatmentSlug]);

  const widerRadius = RADIUS_OPTIONS.find((r) => r > radius) ?? null;


  const inRangeIds = useMemo(
    () => new Set(storefrontsInRange.map((s) => s.id)),
    [storefrontsInRange],
  );

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data.providers)
      for (const s of p.storefronts) counts[s.id] = (counts[s.id] ?? 0) + 1;
    return counts;
  }, [data.providers]);

  /** featured medspas for the explore rail. */
  const featuredStorefronts = useMemo(
    () => data.storefronts.filter((s) => s.featured).slice(0, 10),
    [data.storefronts],
  );

  const providerResults = useMemo(() => {
    return data.providers
      .map((p) => {
        const { hit, via } = matchProvider(p, needle);
        const shops = p.storefronts.filter((s) => inRangeIds.has(s.id));
        const ranked = [...shops].sort(
          (a, b) => (kmById.get(a.id) ?? Infinity) - (kmById.get(b.id) ?? Infinity),
        );
        const km = ranked.length ? (kmById.get(ranked[0].id) ?? null) : null;
        return { p, hit, via, shops: ranked, km };
      })
      .filter((r) => r.hit && r.shops.length > 0)
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [data.providers, needle, inRangeIds, kmById]);

  /** five nearest providers, skin type matches first, for the explore row. */
  const nearbyProviders = useMemo(() => {
    const fitz = patient.profile.skinType ? (FITZ_NUMBER[patient.profile.skinType] ?? null) : null;
    const withMatch = providerResults.map((r) => ({
      ...r,
      matches:
        fitz !== null &&
        r.p.fitzpatrick_min !== null &&
        r.p.fitzpatrick_max !== null &&
        fitz >= r.p.fitzpatrick_min &&
        fitz <= r.p.fitzpatrick_max,
    }));
    return [...withMatch].sort((a, b) => Number(b.matches) - Number(a.matches)).slice(0, 5);
  }, [providerResults, patient.profile.skinType]);

  // a clinic counts as a match when their own website lists the treatment, even
  // when we have nobody on their roster yet.
  const medspaResults = useMemo(
    () =>
      storefrontsInRange
        .map((s) => ({ ...s, ...matchStorefrontVia(s, needle) }))
        .filter((s) => s.hit),
    [storefrontsInRange, needle],
  );

  const treatmentResults = useMemo(() => {
    if (!needle) return [];
    return treatments
      .map((t) => ({ t, ...matchTreatment(t, needle) }))
      .filter((r) => r.hit)
      .slice(0, 20);
  }, [treatments, needle]);

  const showProviders = true;
  const showMedspas = true;
  const showTreatments = true;

  const totalResults =
    (showProviders ? providerResults.length : 0) +
    (showMedspas ? medspaResults.length : 0) +
    (showTreatments ? treatmentResults.length : 0);

  /** how many providers in range offer each treatment, for treatment rows. */
  const treatmentProviderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data.providers) {
      if (!p.storefronts.some((s) => inRangeIds.has(s.id))) continue;
      for (const t of p.treatments) counts[t.treatment_slug] = (counts[t.treatment_slug] ?? 0) + 1;
    }
    return counts;
  }, [data.providers, inRangeIds]);

  /** pins narrowed to whatever the current results reference. */
  const resultStorefronts = useMemo(() => {
    const ids = new Set<string>();
    if (showProviders) for (const r of providerResults) for (const s of r.shops) ids.add(s.id);
    if (showMedspas) for (const s of medspaResults) ids.add(s.id);
    const picked = data.storefronts.filter((s) => ids.has(s.id));
    return picked.length ? picked : storefrontsInRange;
  }, [
    showProviders,
    showMedspas,
    providerResults,
    medspaResults,
    data.storefronts,
    storefrontsInRange,
  ]);

  const countLine = `${totalResults} result${totalResults === 1 ? "" : "s"} in ${locLabel}`;

  return (
    <div className="pb-28">
      {/* sticky search + scope pills */}
      <div className="sticky top-0 z-30 bg-background pt-1 pb-3">
        <div className="px-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-ink-mute" />
            <input
              ref={inputRef}
              aria-label="search providers, medspas and treatments"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="search providers, medspas, treatments"
              className="w-full rounded-pill border border-[rgba(17,17,17,0.08)] bg-cream pl-11 pr-10 py-3 text-[14px] lowercase placeholder:text-ink-mute focus:outline-none focus:border-[rgba(17,17,17,0.18)]"
            />
            {(focused || searching) && q.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 grid place-items-center size-6 rounded-full bg-muted text-ink-mute"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* pinned to a treatment: show the active treatment chip. */}
        {treatmentSlug && (
          <div className="mt-2.5 px-6">
            <span className="inline-flex items-center gap-2 rounded-pill bg-hot px-4 py-1.5 text-[12.5px] font-semibold lowercase text-cream">
              {(filterTreatment?.name ?? treatmentSlug.replace(/-/g, " ")).toLowerCase()}
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/search",
                    search: { q: undefined, scope: undefined, treatment: undefined },
                  })
                }
                aria-label="clear the treatment filter"
              >
                <X className="size-3.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      {treatmentSlug ? (
        /* ---------- one treatment, clinics that list it ---------- */
        <div className="px-6">
          <div className="mt-1">
            <ClientOnly
              fallback={<div className="aspect-[4/3] rounded-[20px] border border-line bg-muted" />}
            >
              <SearchMap
                storefronts={offeringClinics.map((r) => r.s)}
                center={center}
                radiusKm={radius}
                selectedId={selected}
                onSelect={setSelected}
                providerCounts={providerCounts}
                kmById={kmById}
                onViewportChange={setMapBounds}
                onMapInteraction={() => setMapInteracted(true)}
                height="aspect-[4/3]"
                expandable
              />
            </ClientOnly>
          </div>

          <p className="mt-4 text-[12px] lowercase text-ink/60">
            {offeringClinics.length} clinic{offeringClinics.length === 1 ? "" : "s"}
            {location ? ` within ${radius} km` : ` in ${locLabel}`} list{" "}
            {(filterTreatment?.name ?? treatmentSlug.replace(/-/g, " ")).toLowerCase()}
          </p>

          {offeringClinics.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-line p-5 text-center">
              <p className="brand-display text-[20px] lowercase">
                no clinic near you lists this yet.
              </p>
              <p className="mt-1 text-[13px] lowercase text-ink-mute">
                we only show clinics that actually list it. nothing else would be honest.
              </p>
              {widerRadius && (
                <button
                  type="button"
                  onClick={() => setRadius(widerRadius)}
                  className="mt-3 rounded-pill bg-ink px-4 py-2 text-[13px] font-semibold lowercase text-cream"
                >
                  widen to {widerRadius} km
                </button>
              )}
              {!location && (
                <button
                  type="button"
                  onClick={() => setPickingLocation(true)}
                  className="mt-3 block w-full text-[13px] font-semibold lowercase text-hot"
                >
                  set your location
                </button>
              )}
            </div>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-[18px] border border-line bg-white">
              {offeringClinics.map(({ s, offer }) => (
                <li key={s.id} className="border-t border-line first:border-t-0">
                  <Link
                    to="/storefront/$id"
                    params={{ id: s.id }}
                    onClick={() => setSelected(s.id)}
                    className="flex items-center gap-3 px-4 py-3.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[15px] font-semibold lowercase leading-tight">
                        <span className="truncate">{s.name.toLowerCase()}</span>
                        {s.claimed && <BadgeCheck className="size-3.5 shrink-0 text-hot" />}
                      </span>
                      <span className="mt-0.5 block text-[12px] lowercase text-ink/55">
                        {s.km !== null
                          ? `${neighbourhood(s)} · ${formatDistance(s.km)}`
                          : neighbourhood(s)}
                      </span>
                      <span className="mt-1 inline-block rounded-pill bg-mint px-2 py-0.5 text-[11px] lowercase">
                        offers {(filterTreatment?.name ?? offer.name).toLowerCase()}
                        {offer.price_from !== null ? ` · from $${Math.round(offer.price_from)}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink/30" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {offeringClinics.some((r) => !r.offer.verified) && (
            <p className="mt-3 text-[11px] lowercase text-ink/45">
              listed on the clinic's own website, not confirmed with us yet
            </p>
          )}

          {locationReady && (!location || pickingLocation) && (
            <div className="mt-4">
              <LocationCard onDone={() => setPickingLocation(false)} />
            </div>
          )}
        </div>
      ) : searching ? (

        /* ---------- results state ---------- */
        <div className="px-6">
          {/* map stays pinned at the top, pins filtered to the results */}
          <div className="mt-1">
            <ClientOnly
              fallback={<div className="h-[180px] rounded-[20px] border border-line bg-muted" />}
            >
              <SearchMap
                storefronts={visibleMapStorefronts ?? resultStorefronts}
                center={center}
                radiusKm={radius}
                selectedId={selected}
                onSelect={setSelected}
                providerCounts={providerCounts}
                kmById={kmById}
                onViewportChange={setMapBounds}
                onMapInteraction={() => setMapInteracted(true)}
                height="aspect-[4/3]"
                expandable
              />
            </ClientOnly>
          </div>

          {pending ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <p className="mt-4 text-[12px] lowercase text-ink/60">{countLine}</p>

              {showProviders && providerResults.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="brand-eyebrow">providers</h2>
                  </div>
                  <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                    {providerResults.map(({ p, via, shops, km }) => (
                      <ProviderCardCompact
                        key={p.id}
                        provider={p}
                        via={via}
                        km={km}
                        shops={shops}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showMedspas && medspaResults.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="brand-eyebrow">medspas</h2>
                  </div>
                  <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                    {medspaResults.map((s) => (
                      <MedspaCardCompact
                        key={s.id}
                        storefront={s}
                        km={s.km}
                        providers={data.providers.filter((p) =>
                          p.storefronts.some((x) => x.id === s.id),
                        )}
                        viaWebsite={s.viaWebsite}
                        active={selected === s.id}
                        onSelect={() => setSelected(s.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showTreatments && treatmentResults.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="brand-eyebrow">treatments</h2>
                  </div>
                  <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                    {treatmentResults.slice(0, 6).map(({ t }) => (
                      <TreatmentCardCompact
                        key={t.slug}
                        treatment={t}
                        providerCount={treatmentProviderCounts[t.slug] ?? 0}
                        onClick={() => {
                          setQ(t.name.toLowerCase());
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}


              {totalResults === 0 && <EmptyResults onClear={() => setQ("")} />}
            </>
          )}
        </div>
      ) : (
        /* ---------- explore state ---------- */
        <div className="px-6">
          {/* browse by category */}
          <section className="mt-6">
            <h2 className="brand-eyebrow">browse by category</h2>
            <div className="mt-3 grid grid-cols-2 min-[420px]:grid-cols-3 gap-3">
              {BROWSE_CATEGORIES.map((c) => (
                <a
                  key={c.label}
                  href={`/treatments?${new URLSearchParams({ family: c.family }).toString()}`}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-[rgba(17,17,17,0.08)] bg-cream p-4 text-center transition active:scale-[0.97]"
                >
                  <span className={`grid size-11 place-items-center rounded-xl ${c.tile}`}>
                    <c.icon className="size-5 text-ink" strokeWidth={2} />
                  </span>
                  <span className="text-[13px] font-semibold lowercase text-ink leading-tight">
                    {c.label}
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* a) map card */}
          <div className="mt-5 flex items-center justify-between gap-2">
            <h2 className="brand-eyebrow">near you</h2>
            <LocationChip onClick={() => setPickingLocation(true)} />
          </div>

          {locationReady && (!location || pickingLocation) ? (
            <div className="mt-2">
              <LocationCard onDone={() => setPickingLocation(false)} />
              {location && pickingLocation && (
                <button
                  type="button"
                  onClick={() => setPickingLocation(false)}
                  className="mt-3 text-[12px] text-ink/60 lowercase underline"
                >
                  keep {location.label}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mt-2">
                <ClientOnly
                  fallback={
                    <div className="h-[220px] rounded-[20px] border border-line bg-muted" />
                  }
                >
                  <SearchMap
                    storefronts={visibleMapStorefronts ?? storefrontsInRange}
                    center={center}
                    radiusKm={radius}
                    selectedId={selected}
                    onSelect={setSelected}
                    providerCounts={providerCounts}
                    kmById={kmById}
                    onViewportChange={setMapBounds}
                    onMapInteraction={() => setMapInteracted(true)}
                    height="aspect-[4/3]"
                    expandable
                  />
                </ClientOnly>
              </div>

              <div className="mt-3 flex gap-2">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setMapInteracted(false);
                      setRadius(r);
                    }}
                    className={cn(
                      "rounded-pill border px-3 py-1.5 text-[12px] lowercase",
                      radius === r
                        ? "border-ink bg-ink text-cream font-semibold"
                        : "border-line text-ink-mute",
                    )}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </>
          )}

          {/* c) featured storefronts row */}
          {featuredStorefronts.length > 0 && (
            <section className="mt-7">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="brand-eyebrow">featured storefronts</h2>
              </div>

              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6">
                {featuredStorefronts.map((s) => (
                  <FeaturedStorefrontCard
                    key={s.id}
                    storefront={s}
                    providerCount={providerCounts[s.id] ?? 0}
                  />
                ))}
              </div>
            </section>
          )}

          {/* d) providers near you */}
          {nearbyProviders.length > 0 && (
            <section className="mt-7">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="brand-eyebrow">providers near you - coming soon</h2>
                {location ? (
                  <span className="text-[12px] text-ink-mute lowercase">
                    {providerResults.length} within {radius} km
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickingLocation(true)}
                    className="text-[12px] font-semibold text-hot lowercase"
                  >
                    set your location
                  </button>
                )}
              </div>
              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {nearbyProviders.map(({ p, shops, km, matches }) => (
                  <ProviderCardCompact
                    key={p.id}
                    provider={p}
                    km={km}
                    shops={shops}
                    widthClass="w-[78vw] max-w-[320px]"
                    matchesSkinType={matches}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="shrink-0 w-[78vw] max-w-[320px] rounded-[20px] border border-dashed border-[rgba(17,17,17,0.25)] bg-transparent p-3.5 text-left active:scale-[0.98] transition-transform"
                >
                  <span className="grid size-12 place-items-center rounded-full border border-dashed border-[rgba(17,17,17,0.25)]">
                    <ChevronRight className="size-5 text-ink" />
                  </span>
                  <p className="mt-3 text-[14px] font-semibold lowercase leading-tight">
                    see all providers
                  </p>
                  <p className="text-[12px] text-ink/60 lowercase">
                    browse everyone within {radius} km
                  </p>
                </button>
              </div>
            </section>
          )}

          {showMedspas && (
            <section className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="brand-eyebrow">medspas near you</h2>
                {location ? (
                  <span className="text-[12px] text-ink-mute lowercase">
                    {medspaResults.length} within {radius} km
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickingLocation(true)}
                    className="text-[12px] font-semibold text-hot lowercase"
                  >
                    set your location
                  </button>
                )}
              </div>
              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {medspaResults.slice(0, 8).map((s) => (
                  <MedspaCardCompact
                    key={s.id}
                    storefront={s}
                    km={s.km}
                    providers={data.providers.filter((p) =>
                      p.storefronts.some((x) => x.id === s.id),
                    )}
                    viaWebsite={s.viaWebsite}
                    active={selected === s.id}
                    onSelect={() => setSelected(s.id)}
                  />
                ))}
                {medspaResults.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="shrink-0 w-[220px] rounded-[20px] border border-dashed border-[rgba(17,17,17,0.25)] bg-transparent p-3.5 text-left active:scale-[0.98] transition-transform"
                  >
                    <span className="grid size-12 place-items-center rounded-full border border-dashed border-[rgba(17,17,17,0.25)]">
                      <ChevronRight className="size-5 text-ink" />
                    </span>
                    <p className="mt-3 text-[14px] font-semibold lowercase leading-tight">
                      see all medspas
                    </p>
                    <p className="text-[12px] text-ink/60 lowercase">
                      browse all {medspaResults.length} within {radius} km
                    </p>
                  </button>
                )}
              </div>
            </section>
          )}

          {showTreatments && (
            <section className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="brand-eyebrow">popular treatments</h2>
                <Link
                  to="/treatments"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-hot lowercase"
                >
                  browse all <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {treatments.slice(0, 8).map((t) => (
                  <TreatmentCardCompact key={t.slug} treatment={t} />
                ))}
              </div>
            </section>
          )}

          {((showProviders && providerResults.length === 0) ||
            (showMedspas && medspaResults.length === 0)) && (
            <div className="mt-6 rounded-2xl border border-line p-5 text-center">
              <p className="brand-display text-[20px]">nothing within {radius} km.</p>
              <p className="text-[13px] text-ink-mute mt-1 lowercase">
                widen the radius to see everyone we cover.
              </p>
              <button
                type="button"
                onClick={() => setRadius(25)}
                className="mt-3 rounded-pill bg-ink text-cream px-4 py-2 text-[13px] font-semibold lowercase"
              >
                widen to 25 km
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** compact horizontal-rail card for treatments. */
function TreatmentCardCompact({
  treatment,
  providerCount,
  onClick,
}: {
  treatment: SearchTreatment;
  providerCount?: number;
  onClick?: () => void;
}) {
  const body = (
    <>
      {treatment.hero_image_url ? (
        <img
          src={treatment.hero_image_url}
          alt={treatment.name}
          loading="lazy"
          className="size-12 rounded-xl object-cover"
        />
      ) : (
        <span className="size-12 rounded-xl bg-mint grid place-items-center text-[13px] font-bold lowercase">
          {treatment.name.slice(0, 2).toLowerCase()}
        </span>
      )}
      <p className="mt-2.5 text-[14px] font-semibold lowercase leading-tight truncate">
        {treatment.name}
      </p>
      <p className="text-[11px] text-ink-mute lowercase truncate">
        {treatment.descriptor || treatment.category || treatment.family}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {providerCount !== undefined && (
          <span className="shrink-0 rounded-pill bg-muted px-2 py-0.5 text-[10px] lowercase">
            {providerCount} provider{providerCount === 1 ? "" : "s"}
          </span>
        )}
        {treatment.price_from !== null && (
          <span className="text-[11px] font-semibold lowercase">from ${treatment.price_from}</span>
        )}
      </div>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 w-[158px] rounded-[20px] border border-line bg-white p-3 text-left active:scale-[0.98] transition-transform"
      >
        {body}
      </button>
    );
  }
  return (
    <Link
      to="/treatment/$slug"
      params={{ slug: treatment.slug }}
      className="shrink-0 w-[158px] rounded-[20px] border border-line bg-white p-3 text-left active:scale-[0.98] transition-transform"
    >
      {body}
    </Link>
  );
}

function MedspaCard({
  storefront,
  km,
  providers,
  viaWebsite = false,
  active,
  onSelect,
}: {
  storefront: Storefront;
  /** null when we do not know where the patient is. show the area instead. */
  km: number | null;
  providers: Provider[];
  /** the clinic only matched because their website lists it. say so. */
  viaWebsite?: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn("rounded-2xl border p-4 bg-white", active ? "border-hot" : "border-line")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="brand-display text-[18px]">{storefront.name}</p>
        <span className="text-[12px] text-ink-soft inline-flex items-center gap-1">
          <Star className="size-3 fill-ink text-ink" />
          {storefront.rating}
        </span>
      </div>
      <p className="text-[12px] text-ink-mute lowercase">{storefront.tagline}</p>
      <p className="mt-1 text-[12px] text-ink-soft lowercase inline-flex items-center gap-1">
        <MapPin className="size-3.5 text-hot" />
        {addressLine(storefront)}, {storefront.city.toLowerCase()}
        {km !== null && ` · ${formatDistance(km)}`}
      </p>
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <p className="text-[11px] font-semibold lowercase tracking-[0.06em] text-ink-mute">
          {providers.length} provider{providers.length === 1 ? "" : "s"} here
        </p>
        {providers.map((p) => (
          <Link
            key={p.id}
            to="/providers/$slug"
            params={{ slug: p.slug }}
            className="flex items-center gap-2.5"
          >
            <Avatar name={p.name} url={p.avatar_url} size="size-9" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold lowercase leading-tight line-clamp-2 break-words">
                {p.name}
              </span>
              <span className="block text-[11px] text-ink-mute lowercase truncate">{p.title}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** compact horizontal-rail card for medspas. */
function MedspaCardCompact({
  storefront,
  km,
  providers,
  viaWebsite = false,
  active,
  onSelect,
}: {
  storefront: Storefront;
  /** null when we do not know where the patient is. show the area instead. */
  km: number | null;
  providers: Provider[];
  /** the clinic only matched because their website lists it. say so. */
  viaWebsite?: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      to="/storefront/$id"
      params={{ id: storefront.id }}
      onClick={onSelect}
      className={cn(
        "shrink-0 w-[220px] rounded-[20px] border overflow-hidden bg-white block active:scale-[0.98] transition-transform",
        active ? "border-hot" : "border-line",
      )}
    >
      {storefront.hero_image_url ? (
        <img
          src={storefront.hero_image_url}
          alt={`${storefront.name} interior`}
          loading="lazy"
          className="h-[110px] w-full object-cover"
        />
      ) : (
        <div className="h-[110px] w-full bg-mint grid place-items-center">
          <span className="brand-display text-[34px] text-ink lowercase">{storefront.name[0]}</span>
        </div>
      )}
      <div className="p-3">
        <p className="text-[14px] font-semibold inline-flex items-center gap-1 leading-tight line-clamp-2 break-words">
          {storefront.name}
          {storefront.claimed && <BadgeCheck className="size-3.5 text-hot shrink-0" />}
        </p>
        <p className="text-[11px] text-ink-mute lowercase mt-0.5 truncate">{storefront.tagline}</p>
        <p className="mt-1.5 text-[11px] text-ink-soft lowercase inline-flex items-center gap-1">
          <MapPin className="size-3 text-hot" />
          {km !== null ? `${areaLine(storefront)} · ${formatDistance(km)}` : areaLine(storefront)}
        </p>
        <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2">
          {providers.slice(0, 3).map((p) => (
            <Avatar key={p.id} name={p.name} url={p.avatar_url} size="size-7" />
          ))}
          {/* never advertise zero. fall back to what they list. */}
          {providers.length > 0 ? (
            <span className="text-[11px] text-ink-mute lowercase">
              {providers.length} provider{providers.length === 1 ? "" : "s"}
            </span>
          ) : storefront.listed.length > 0 ? (
            <span className="text-[11px] text-ink-mute lowercase">
              {storefront.listed.length} treatment{storefront.listed.length === 1 ? "" : "s"} listed
            </span>
          ) : null}
        </div>
        {viaWebsite && (
          <p className="mt-1.5 text-[11px] lowercase text-ink/45">listed on their website</p>
        )}
      </div>
    </Link>
  );
}

function FeaturedStorefrontCard({
  storefront,
  providerCount,
}: {
  storefront: Storefront;
  providerCount: number;
}) {
  return (
    <Link
      to="/storefront/$id"
      params={{ id: storefront.id }}
      className="shrink-0 w-[260px] rounded-[20px] border border-line overflow-hidden bg-white"
    >
      {storefront.hero_image_url ? (
        <img
          src={storefront.hero_image_url}
          alt={`${storefront.name} interior`}
          loading="lazy"
          className="h-[132px] w-full object-cover"
        />
      ) : (
        <div className="h-[132px] w-full bg-mint grid place-items-center">
          <span className="brand-display text-[40px] text-ink lowercase">{storefront.name[0]}</span>
        </div>
      )}
      <div className="p-3">
        <p className="text-[14px] font-semibold inline-flex items-center gap-1">
          {storefront.name}
          {storefront.claimed && <BadgeCheck className="size-3.5 text-hot" />}
        </p>
        <p className="text-[12px] text-ink-mute lowercase mt-0.5">{areaLine(storefront)}</p>
        <div className="mt-2 flex items-center gap-2">
          {providerCount > 0 ? (
            <span className="text-[12px] text-ink-soft lowercase">
              {providerCount} {providerCount === 1 ? "provider" : "providers"}
            </span>
          ) : storefront.listed.length > 0 ? (
            <span className="text-[12px] text-ink-soft lowercase">
              {storefront.listed.length} treatment{storefront.listed.length === 1 ? "" : "s"} listed
            </span>
          ) : null}
          {storefront.review_count > 0 ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
              <Star className="size-3 fill-ink text-ink" />
              {storefront.rating}
            </span>
          ) : (
            <span className="rounded-pill bg-butter px-2 py-0.5 text-[11px] font-semibold lowercase">
              new to treatme
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** shimmering placeholder in the same shape as a provider card. */
function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-white p-3.5">
      <span className="size-14 shrink-0 rounded-full bg-muted animate-pulse" />
      <div className="min-w-0 flex-1 space-y-2 py-1">
        <span className="block h-3.5 w-2/5 rounded-pill bg-muted animate-pulse" />
        <span className="block h-3 w-3/5 rounded-pill bg-muted animate-pulse" />
        <span className="block h-3 w-1/2 rounded-pill bg-muted animate-pulse" />
        <span className="block h-5 w-4/5 rounded-pill bg-muted animate-pulse" />
      </div>
    </div>
  );
}

/** shown when the debounced query returns nothing. */
function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="size-16 rounded-full bg-mint grid place-items-center">
        <SearchIcon className="size-6 text-ink" />
      </span>
      <p className="brand-display text-[22px] mt-4">nothing here yet</p>
      <p className="text-[13px] text-ink-mute lowercase mt-1.5 max-w-[240px]">
        try a different treatment or widen your area
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-pill bg-ink text-cream px-5 py-2.5 text-[13px] font-semibold lowercase"
      >
        clear search
      </button>
    </div>
  );
}
