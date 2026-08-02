import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search as SearchIcon,
  X,
  MapPin,
  Star,
  Navigation,
  Loader2,
  ArrowRight,
  BadgeCheck,
} from "lucide-react";

import {
  directoryQuery,
  searchTreatmentsQuery,
  distanceKm,
  formatDistance,
  matchProvider,
  matchTreatment,
  matchStorefront,
  providerFromPrice,
  LOCATION_PRESETS,
  neighbourhood,
  RADIUS_OPTIONS,
  type LatLng,
  type Provider,
  type Storefront,
  type SearchTreatment,
} from "@/lib/search-data";
import { SearchMap } from "@/components/treatme/SearchMap";
import { Avatar, ProviderCardCompact } from "@/components/treatme/ProviderCard";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/search/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
  }),
  head: () => ({
    meta: [
      { title: "find a provider · treatme" },
      {
        name: "description",
        content: "search aesthetic doctors, nurses and specialists near you, and see the medspa each one works at.",
      },
      { property: "og:title", content: "find a provider · treatme" },
      {
        property: "og:description",
        content: "search aesthetic doctors, nurses and specialists near you, and see the medspa each one works at.",
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

type Scope = "all" | "providers" | "medspas" | "treatments";
const SCOPES: Scope[] = ["all", "providers", "medspas", "treatments"];

/** available search scopes. */
const SCOPES: Scope[] = ["all", "providers", "medspas", "treatments"];








function SearchPage() {
  const { data } = useSuspenseQuery(directoryQuery);
  const { data: treatments } = useSuspenseQuery(searchTreatmentsQuery);

  const { q: initialQ = "", scope: initialScope } = Route.useSearch();
  const [q, setQ] = useState(initialQ);
  const [focused, setFocused] = useState(false);
  const [scope, setScope] = useState<Scope>(
    initialScope && (SCOPES as readonly string[]).includes(initialScope)
      ? (initialScope as Scope)
      : initialQ
        ? "providers"
        : "all",
  );
  const [radius, setRadius] = useState<number>(10);
  const [locLabel, setLocLabel] = useState<string>(LOCATION_PRESETS[0].label);
  const [center, setCenter] = useState<LatLng>(LOCATION_PRESETS[0].point);
  const [locating, setLocating] = useState(false);
  const [expandProviders, setExpandProviders] = useState(false);


  const [selected, setSelected] = useState<string | null>(null);
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

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLabel("your location");
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const storefrontsInRange = useMemo(
    () =>
      data.storefronts
        .map((s) => ({ ...s, km: distanceKm(center, { lat: s.lat, lng: s.lng }) }))
        .filter((s) => s.km <= radius)
        .sort((a, b) => a.km - b.km),
    [data.storefronts, center, radius],
  );

  const inRangeIds = useMemo(() => new Set(storefrontsInRange.map((s) => s.id)), [storefrontsInRange]);

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data.providers) for (const s of p.storefronts) counts[s.id] = (counts[s.id] ?? 0) + 1;
    return counts;
  }, [data.providers]);

  /** featured medspas for the explore rail. */
  const featuredStorefronts = useMemo(
    () => data.storefronts.filter((s) => s.featured).slice(0, 10),
    [data.storefronts],
  );

  /** reset provider preview when filters change. */
  useEffect(() => {
    setExpandProviders(false);
  }, [q, radius, center]);



  const providerResults = useMemo(() => {
    return data.providers
      .map((p) => {
        const { hit, via } = matchProvider(p, needle);
        const shops = p.storefronts.filter((s) => inRangeIds.has(s.id));
        const ranked = [...shops].sort(
          (a, b) =>
            distanceKm(center, { lat: a.lat, lng: a.lng }) - distanceKm(center, { lat: b.lat, lng: b.lng }),
        );
        const km = ranked.length
          ? distanceKm(center, { lat: ranked[0].lat, lng: ranked[0].lng })
          : Infinity;
        return { p, hit, via, shops: ranked, km };
      })
      .filter((r) => r.hit && r.shops.length > 0)
      .sort((a, b) => a.km - b.km);
  }, [data.providers, needle, inRangeIds, center]);

  const medspaResults = useMemo(
    () => storefrontsInRange.filter((s) => matchStorefront(s, needle)),
    [storefrontsInRange, needle],
  );

  const treatmentResults = useMemo(() => {
    if (!needle) return [];
    return treatments
      .map((t) => ({ t, ...matchTreatment(t, needle) }))
      .filter((r) => r.hit)
      .slice(0, 20);
  }, [treatments, needle]);

  const showProviders = scope === "all" || scope === "providers";
  const showMedspas = scope === "all" || scope === "medspas";
  const showTreatments = scope === "all" || scope === "treatments";

  const mapStorefronts: Storefront[] = scope === "medspas" ? medspaResults : storefrontsInRange;

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
  }, [showProviders, showMedspas, providerResults, medspaResults, data.storefronts, storefrontsInRange]);

  const countLine = (() => {
    const where = ` in ${locLabel}`;
    if (scope === "providers") return `${providerResults.length} provider${providerResults.length === 1 ? "" : "s"}${where}`;
    if (scope === "medspas") return `${medspaResults.length} medspa${medspaResults.length === 1 ? "" : "s"}${where}`;
    if (scope === "treatments") return `${treatmentResults.length} treatment${treatmentResults.length === 1 ? "" : "s"}`;
    return `${totalResults} result${totalResults === 1 ? "" : "s"}${where}`;
  })();

  return (
    <div className="pb-28">
      {/* sticky search + scope pills */}
      <div className="sticky top-0 z-30 bg-background pt-1 pb-3">
        <div className="px-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-ink-mute" />
            <input
              ref={inputRef}
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

        <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar px-6">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "shrink-0 rounded-pill px-4 py-1.5 text-[12.5px] font-semibold lowercase transition-colors",
                scope === s
                  ? "bg-hot text-cream border border-hot"
                  : "bg-transparent text-ink border border-[rgba(17,17,17,0.12)]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {searching ? (
        /* ---------- results state ---------- */
        <div className="px-6">
          {/* map stays pinned at the top, pins filtered to the results */}
          <div className="mt-1">
            <ClientOnly fallback={<div className="h-[180px] rounded-[20px] border border-line bg-muted" />}>
              <SearchMap
                storefronts={resultStorefronts}
                center={center}
                radiusKm={radius}
                selectedId={selected}
                onSelect={setSelected}
                providerCounts={providerCounts}
                height="h-[180px]"
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
                  {scope === "all" && (
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="brand-eyebrow">providers</p>
                      {providerResults.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setScope("providers")}
                          className="text-[12px] font-semibold text-hot lowercase"
                        >
                          see all {providerResults.length}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                    {(scope === "all" ? providerResults.slice(0, 6) : providerResults).map(
                      ({ p, via, shops, km }) => (
                        <ProviderCardCompact key={p.id} provider={p} via={via} km={km} shops={shops} />
                      ),
                    )}
                  </div>
                </section>
              )}


              {showMedspas && medspaResults.length > 0 && (
                <section className="mt-6">
                  {scope === "all" && (
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="brand-eyebrow">medspas</p>
                      {medspaResults.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setScope("medspas")}
                          className="text-[12px] font-semibold text-hot lowercase"
                        >
                          see all {medspaResults.length}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                    {(scope === "all" ? medspaResults.slice(0, 6) : medspaResults).map((s) => (
                      <MedspaCardCompact
                        key={s.id}
                        storefront={s}
                        km={s.km}
                        providers={data.providers.filter((p) => p.storefronts.some((x) => x.id === s.id))}
                        active={selected === s.id}
                        onSelect={() => setSelected(s.id)}
                      />
                    ))}
                  </div>
                </section>
              )}


              {showTreatments && treatmentResults.length > 0 && (
                <section className="mt-6">
                  {scope === "all" && (
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="brand-eyebrow">treatments</p>
                      {treatmentResults.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setScope("treatments")}
                          className="text-[12px] font-semibold text-hot lowercase"
                        >
                          see all {treatmentResults.length}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                    {(scope === "all" ? treatmentResults.slice(0, 6) : treatmentResults).map(({ t }) => (
                      <TreatmentCardCompact
                        key={t.slug}
                        treatment={t}
                        providerCount={treatmentProviderCounts[t.slug] ?? 0}
                        onClick={() => {
                          setQ(t.name.toLowerCase());
                          setScope("providers");
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
          {/* a) map card */}
          <div className="mt-5 flex items-center justify-between gap-2">
            <p className="brand-eyebrow">near you</p>
            <span className="inline-flex items-center gap-1 rounded-pill border border-[rgba(17,17,17,0.10)] px-2.5 py-1 text-[11px] text-ink-mute lowercase">
              <MapPin className="size-3" />
              toronto, on
            </span>
          </div>

          <div className="mt-2">
            <ClientOnly fallback={<div className="h-[220px] rounded-[20px] border border-line bg-muted" />}>
              <SearchMap
                storefronts={storefrontsInRange}
                center={center}
                radiusKm={radius}
                selectedId={selected}
                onSelect={setSelected}
                providerCounts={providerCounts}
                height="h-[220px]"
                expandable
              />
            </ClientOnly>
          </div>



          <h1 className="brand-display text-[30px] leading-[0.95] mt-6">
            find your provider<span className="text-hot">.</span>
          </h1>
          <p className="text-[13px] text-ink-mute mt-2 lowercase">
            real people, tagged to the medspa they work at.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-white px-3 py-1.5 text-[12px] font-semibold lowercase"
            >
              {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5" />}
              use my location
            </button>
            <span className="text-[12px] text-ink-mute lowercase">near {locLabel}</span>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
            {LOCATION_PRESETS.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => {
                  setCenter(l.point);
                  setLocLabel(l.label);
                }}
                className={cn(
                  "shrink-0 rounded-pill border px-3 py-1.5 text-[12px] lowercase",
                  locLabel === l.label ? "border-hot bg-hot/10 text-ink font-semibold" : "border-line text-ink-mute",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={cn(
                  "rounded-pill border px-3 py-1.5 text-[12px] lowercase",
                  radius === r ? "border-ink bg-ink text-cream font-semibold" : "border-line text-ink-mute",
                )}
              >
                {r} km
              </button>
            ))}
          </div>
          {/* c) featured storefronts row */}
          {featuredStorefronts.length > 0 && (
            <section className="mt-7">
              <div className="flex items-baseline justify-between gap-3">
                <p className="brand-eyebrow">featured storefronts</p>
                <button
                  type="button"
                  onClick={() => setScope("medspas")}
                  className="text-[12px] text-hot lowercase font-semibold"
                >
                  see all
                </button>
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

          {/* d) nearby providers rail */}
          {showProviders && (
            <section className="mt-7">
              <div className="flex items-baseline justify-between gap-3">
                <p className="brand-eyebrow">providers near you</p>
                <span className="text-[12px] text-ink-mute lowercase">
                  {providerResults.length} within {radius} km
                </span>
              </div>
              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {providerResults.map(({ p, shops, km }) => (
                  <ProviderCardCompact key={p.id} provider={p} km={km} shops={shops} />
                ))}
              </div>
            </section>
          )}

          {showMedspas && (
            <section className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="brand-eyebrow">medspas near you</p>
                <span className="text-[12px] text-ink-mute lowercase">
                  {medspaResults.length} within {radius} km
                </span>
              </div>
              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {medspaResults.map((s) => (
                  <MedspaCardCompact
                    key={s.id}
                    storefront={s}
                    km={s.km}
                    providers={data.providers.filter((p) => p.storefronts.some((x) => x.id === s.id))}
                    active={selected === s.id}
                    onSelect={() => setSelected(s.id)}
                  />
                ))}
              </div>
            </section>
          )}


          {showTreatments && (
            <section className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="brand-eyebrow">popular treatments</p>
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


          {((showProviders && providerResults.length === 0) || (showMedspas && medspaResults.length === 0)) && (
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

function TreatmentRow({ treatment, via }: { treatment: SearchTreatment; via?: string }) {
  return (
    <Link
      to="/treatment/$slug"
      params={{ slug: treatment.slug }}
      className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3"
    >
      {treatment.hero_image_url ? (
        <img
          src={treatment.hero_image_url}
          alt={treatment.name}
          loading="lazy"
          className="size-11 rounded-xl object-cover shrink-0"
        />
      ) : (
        <span className="size-11 shrink-0 rounded-xl bg-mint grid place-items-center text-[13px] font-bold">
          {treatment.name.slice(0, 2).toLowerCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold lowercase truncate">{treatment.name}</span>
        <span className="block text-[11.5px] text-ink-mute lowercase truncate">
          {treatment.category || treatment.family}
        </span>
        {via && <span className="block text-[11px] text-hot lowercase">matched: {via}</span>}
      </span>
      {treatment.price_from !== null && (
        <span className="shrink-0 text-[12px] font-semibold lowercase">from ${treatment.price_from}</span>
      )}
    </Link>
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
      <p className="mt-2.5 text-[14px] font-semibold lowercase leading-tight truncate">{treatment.name}</p>
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
  active,
  onSelect,
}: {
  storefront: Storefront;
  km: number;
  providers: Provider[];
  active: boolean;
  onSelect: () => void;
}) {

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-2xl border p-4 bg-white",
        active ? "border-hot" : "border-line",
      )}
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
        {storefront.address_line}, {storefront.city} {storefront.postcode.toLowerCase()} · {formatDistance(km)}
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
              <span className="block text-[13px] font-semibold lowercase truncate">{p.name}</span>
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
  active,
  onSelect,
}: {
  storefront: Storefront;
  km: number;
  providers: Provider[];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "shrink-0 w-[220px] rounded-[20px] border overflow-hidden bg-white",
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
        <p className="text-[14px] font-semibold lowercase inline-flex items-center gap-1 truncate">
          {storefront.name}
          {storefront.claimed && <BadgeCheck className="size-3.5 text-hot shrink-0" />}
        </p>
        <p className="text-[11px] text-ink-mute lowercase mt-0.5 truncate">{storefront.tagline}</p>
        <p className="mt-1.5 text-[11px] text-ink-soft lowercase inline-flex items-center gap-1">
          <MapPin className="size-3 text-hot" />
          {storefront.address_line}, {storefront.city} · {formatDistance(km)}
        </p>
        <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2">
          {providers.slice(0, 3).map((p) => (
            <Avatar key={p.id} name={p.name} url={p.avatar_url} size="size-7" />
          ))}
          <span className="text-[11px] text-ink-mute lowercase">
            {providers.length} provider{providers.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
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
        <p className="text-[14px] font-semibold lowercase inline-flex items-center gap-1">
          {storefront.name}
          {storefront.claimed && <BadgeCheck className="size-3.5 text-hot" />}
        </p>
        <p className="text-[12px] text-ink-mute lowercase mt-0.5">{neighbourhood(storefront)}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12px] text-ink-soft lowercase">
            {providerCount} {providerCount === 1 ? "provider" : "providers"}
          </span>
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

/** treatment result row: name, one line description, provider count. */
function TreatmentResultRow({
  treatment,
  providerCount,
  onSelect,
}: {
  treatment: SearchTreatment;
  providerCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left"
    >
      {treatment.hero_image_url ? (
        <img
          src={treatment.hero_image_url}
          alt={treatment.name}
          loading="lazy"
          className="size-11 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="size-11 shrink-0 rounded-xl bg-mint grid place-items-center text-[13px] font-bold lowercase">
          {treatment.name.slice(0, 2).toLowerCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold lowercase truncate">{treatment.name}</span>
        <span className="block text-[11.5px] text-ink-mute lowercase truncate">
          {treatment.descriptor || treatment.category || treatment.family}
        </span>
      </span>
      <span className="shrink-0 rounded-pill bg-muted px-2 py-0.5 text-[11px] lowercase">
        {providerCount} provider{providerCount === 1 ? "" : "s"}
      </span>
    </button>
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
