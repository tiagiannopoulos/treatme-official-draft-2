import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search as SearchIcon, X, MapPin, Star, Navigation, Loader2 } from "lucide-react";
import { ClientOnly } from "@tanstack/react-router";
import {
  directoryQuery,
  distanceKm,
  formatDistance,
  matchProvider,
  providerFromPrice,
  LOCATION_PRESETS,
  RADIUS_OPTIONS,
  type LatLng,
  type Provider,
  type Storefront,
} from "@/lib/search-data";
import { SearchMap } from "@/components/treatme/SearchMap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search")({
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

type Mode = "providers" | "medspas";

function SearchPage() {
  const { data } = useSuspenseQuery(directoryQuery);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("providers");
  const [radius, setRadius] = useState<number>(10);
  const [locLabel, setLocLabel] = useState<string>(LOCATION_PRESETS[0].label);
  const [center, setCenter] = useState<LatLng>(LOCATION_PRESETS[0].point);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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

  const providers = useMemo(() => {
    return data.providers
      .map((p) => {
        const { hit, via } = matchProvider(p, q);
        const shops = p.storefronts.filter((s) => inRangeIds.has(s.id));
        const km = shops.length
          ? Math.min(...shops.map((s) => distanceKm(center, { lat: s.lat, lng: s.lng })))
          : Infinity;
        return { p, hit, via, shops, km };
      })
      .filter((r) => r.hit && r.shops.length > 0)
      .sort((a, b) => a.km - b.km);
  }, [data.providers, q, inRangeIds, center]);

  const medspas = useMemo(() => {
    const needle = q.toLowerCase();
    return storefrontsInRange.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(needle) ||
        s.city.toLowerCase().includes(needle) ||
        s.postcode.toLowerCase().includes(needle),
    );
  }, [storefrontsInRange, q]);

  const mapStorefronts: Storefront[] = mode === "medspas" ? medspas : storefrontsInRange;

  return (
    <div className="pb-28">
      <div className="px-6">
        <p className="brand-eyebrow">who treats you</p>
        <h1 className="brand-display text-[30px] leading-[0.95] mt-1">
          find your provider<span className="text-hot">.</span>
        </h1>
        <p className="text-[13px] text-ink-mute mt-2 lowercase">
          real people, tagged to the medspa they work at.
        </p>

        <div className="relative mt-4">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search providers, medspas or treatments"
            className="w-full rounded-pill border border-line bg-white pl-10 pr-9 py-3 text-[14px] lowercase placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-hot/40"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="inline-flex rounded-pill border border-line p-0.5 bg-white">
            {(["providers", "medspas"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "px-3.5 py-1.5 rounded-pill text-[12px] font-semibold lowercase transition-colors",
                  mode === m ? "bg-ink text-cream" : "text-ink-mute",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-white px-3 py-1.5 text-[12px] font-semibold lowercase"
          >
            {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5" />}
            use my location
          </button>
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

        <div className="mt-4">
          <ClientOnly fallback={<div className="h-[320px] rounded-2xl border border-line bg-muted" />}>
            <SearchMap
              storefronts={mapStorefronts}
              center={center}
              selectedId={selected}
              onSelect={(id) => setSelected(id)}
            />
          </ClientOnly>
        </div>

        <p className="mt-4 text-[12px] text-ink-mute lowercase">
          {mode === "providers"
            ? `${providers.length} provider${providers.length === 1 ? "" : "s"} within ${radius} km of ${locLabel}`
            : `${medspas.length} medspa${medspas.length === 1 ? "" : "s"} within ${radius} km of ${locLabel}`}
        </p>
      </div>

      <div className="px-6 mt-3 space-y-3">
        {mode === "providers" &&
          providers.map(({ p, via, shops, km }) => (
            <ProviderCard key={p.id} provider={p} via={via} km={km} shopName={shops[0]?.name ?? ""} />
          ))}

        {mode === "medspas" &&
          medspas.map((s) => (
            <MedspaCard
              key={s.id}
              storefront={s}
              km={s.km}
              providers={data.providers.filter((p) => p.storefronts.some((x) => x.id === s.id))}
              active={selected === s.id}
              onSelect={() => setSelected(s.id)}
            />
          ))}

        {((mode === "providers" && providers.length === 0) || (mode === "medspas" && medspas.length === 0)) && (
          <div className="rounded-2xl border border-line p-5 text-center">
            <p className="brand-display text-[20px]">nothing within {radius} km.</p>
            <p className="text-[13px] text-ink-mute mt-1 lowercase">
              widen the radius or clear your search to see everyone we cover.
            </p>
            <button
              type="button"
              onClick={() => {
                setRadius(25);
                setQ("");
              }}
              className="mt-3 rounded-pill bg-ink text-cream px-4 py-2 text-[13px] font-semibold lowercase"
            >
              widen to 25 km
            </button>
          </div>
        )}
      </div>
    </div>
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
