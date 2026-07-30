import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Search as SearchIcon, X, MapPin, Star, Navigation, Loader2, ArrowRight } from "lucide-react";

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
  RADIUS_OPTIONS,
  type LatLng,
  type Provider,
  type Storefront,
  type SearchTreatment,
} from "@/lib/search-data";
import { SearchMap } from "@/components/treatme/SearchMap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search/")({
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

function SearchPage() {
  const { data } = useSuspenseQuery(directoryQuery);
  const { data: treatments } = useSuspenseQuery(searchTreatmentsQuery);

  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [radius, setRadius] = useState<number>(10);
  const [locLabel, setLocLabel] = useState<string>(LOCATION_PRESETS[0].label);
  const [center, setCenter] = useState<LatLng>(LOCATION_PRESETS[0].point);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searching = q.trim().length > 0;

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

  /** every storefront with coordinates, for the explore map card. */
  const pinnedStorefronts = useMemo(
    () => data.storefronts.filter((s) => typeof s.lat === "number" && typeof s.lng === "number"),
    [data.storefronts],
  );

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data.providers) for (const s of p.storefronts) counts[s.id] = (counts[s.id] ?? 0) + 1;
    return counts;
  }, [data.providers]);


  const providerResults = useMemo(() => {
    return data.providers
      .map((p) => {
        const { hit, via } = matchProvider(p, q.trim());
        const shops = p.storefronts.filter((s) => inRangeIds.has(s.id));
        const km = shops.length
          ? Math.min(...shops.map((s) => distanceKm(center, { lat: s.lat, lng: s.lng })))
          : Infinity;
        return { p, hit, via, shops, km };
      })
      .filter((r) => r.hit && r.shops.length > 0)
      .sort((a, b) => a.km - b.km);
  }, [data.providers, q, inRangeIds, center]);

  const medspaResults = useMemo(
    () => storefrontsInRange.filter((s) => matchStorefront(s, q.trim())),
    [storefrontsInRange, q],
  );

  const treatmentResults = useMemo(() => {
    if (!searching) return [];
    return treatments
      .map((t) => ({ t, ...matchTreatment(t, q.trim()) }))
      .filter((r) => r.hit)
      .slice(0, 20);
  }, [treatments, q, searching]);

  const showProviders = scope === "all" || scope === "providers";
  const showMedspas = scope === "all" || scope === "medspas";
  const showTreatments = scope === "all" || scope === "treatments";

  const mapStorefronts: Storefront[] = scope === "medspas" ? medspaResults : storefrontsInRange;

  const totalResults =
    (showProviders ? providerResults.length : 0) +
    (showMedspas ? medspaResults.length : 0) +
    (showTreatments ? treatmentResults.length : 0);

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
          <p className="text-[12px] text-ink-mute lowercase">
            {totalResults} result{totalResults === 1 ? "" : "s"} for "{q.trim().toLowerCase()}"
          </p>

          {showProviders && providerResults.length > 0 && (
            <section className="mt-4">
              <p className="brand-eyebrow">providers</p>
              <div className="mt-2 space-y-3">
                {providerResults.map(({ p, via, shops, km }) => (
                  <ProviderCard key={p.id} provider={p} via={via} km={km} shopName={shops[0]?.name ?? ""} />
                ))}
              </div>
            </section>
          )}

          {showMedspas && medspaResults.length > 0 && (
            <section className="mt-6">
              <p className="brand-eyebrow">medspas</p>
              <div className="mt-2 space-y-3">
                {medspaResults.map((s) => (
                  <MedspaCard
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
              <p className="brand-eyebrow">treatments</p>
              <div className="mt-2 space-y-2">
                {treatmentResults.map(({ t, via }) => (
                  <TreatmentRow key={t.slug} treatment={t} via={via} />
                ))}
              </div>
            </section>
          )}

          {totalResults === 0 && (
            <div className="mt-6 rounded-2xl border border-line p-5 text-center">
              <p className="brand-display text-[20px]">no matches for "{q.trim().toLowerCase()}".</p>
              <p className="text-[13px] text-ink-mute mt-1 lowercase">
                try a treatment name, a medspa, or widen your radius.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setRadius(25)}
                  className="rounded-pill bg-ink text-cream px-4 py-2 text-[13px] font-semibold lowercase"
                >
                  widen to 25 km
                </button>
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="rounded-pill border border-line px-4 py-2 text-[13px] font-semibold lowercase"
                >
                  clear search
                </button>
              </div>
            </div>
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
                storefronts={pinnedStorefronts}
                center={center}
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


          {showProviders && (
            <section className="mt-6">
              <p className="brand-eyebrow">providers near you</p>
              <p className="text-[12px] text-ink-mute lowercase mt-0.5">
                {providerResults.length} within {radius} km of {locLabel}
              </p>
              <div className="mt-2 space-y-3">
                {providerResults.map(({ p, shops, km }) => (
                  <ProviderCard key={p.id} provider={p} km={km} shopName={shops[0]?.name ?? ""} />
                ))}
              </div>
            </section>
          )}

          {showMedspas && (
            <section className="mt-6">
              <p className="brand-eyebrow">medspas near you</p>
              <p className="text-[12px] text-ink-mute lowercase mt-0.5">
                {medspaResults.length} within {radius} km of {locLabel}
              </p>
              <div className="mt-2 space-y-3">
                {medspaResults.map((s) => (
                  <MedspaCard
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
              <p className="brand-eyebrow">popular treatments</p>
              <div className="mt-2 space-y-2">
                {treatments.slice(0, 6).map((t) => (
                  <TreatmentRow key={t.slug} treatment={t} />
                ))}
              </div>
              <Link
                to="/treatments"
                className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-hot lowercase"
              >
                browse the full library <ArrowRight className="size-3.5" />
              </Link>
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
      to="/treatments/$slug"
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


function Avatar({ name, url, size = "size-14" }: { name: string; url: string | null; size?: string }) {
  const initials = name
    .split(" ")
    .filter((w) => !w.startsWith("dr"))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (url) return <img src={url} alt={name} className={cn(size, "rounded-full object-cover")} loading="lazy" />;
  return (
    <span className={cn(size, "rounded-full bg-bubblegum/50 text-ink grid place-items-center font-bold text-[15px]")}>
      {initials}
    </span>
  );
}

function ProviderCard({
  provider,
  via,
  km,
  shopName,
}: {
  provider: Provider;
  via?: string;
  km: number;
  shopName: string;
}) {
  const price = providerFromPrice(provider);
  return (
    <Link
      to="/providers/$slug"
      params={{ slug: provider.slug }}
      className="flex gap-3 rounded-2xl border border-line p-3.5 bg-white active:scale-[0.995] transition-transform"
    >
      <Avatar name={provider.name} url={provider.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="brand-display text-[17px] leading-tight truncate">{provider.name}</p>
          <span className="shrink-0 inline-flex items-center gap-1 text-[12px] text-ink-soft">
            <Star className="size-3 fill-ink text-ink" />
            {provider.rating}
          </span>
        </div>
        <p className="text-[12px] text-ink-mute lowercase">
          {provider.title} · {provider.years_experience} yrs
        </p>
        <p className="mt-1 text-[12px] text-ink-soft lowercase inline-flex items-center gap-1">
          <MapPin className="size-3.5 text-hot" />
          {shopName} · {formatDistance(km)}
        </p>
        {provider.storefronts.length > 1 && (
          <p className="text-[11px] text-ink-mute lowercase">
            + {provider.storefronts.length - 1} other location
            {provider.storefronts.length - 1 === 1 ? "" : "s"}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {provider.treatments.slice(0, 3).map((t) => (
            <span key={t.treatment_slug} className="rounded-pill bg-muted px-2 py-0.5 text-[11px] lowercase">
              {t.name}
            </span>
          ))}
          {price !== null && (
            <span className="rounded-pill bg-butter px-2 py-0.5 text-[11px] font-semibold lowercase">
              from ${price}
            </span>
          )}
        </div>
        {via && <p className="mt-1.5 text-[11px] text-hot lowercase">matched: {via}</p>}
      </div>
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
