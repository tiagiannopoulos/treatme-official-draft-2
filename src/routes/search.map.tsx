import { ClientOnly, createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import {
  directoryQuery,
  nearbyStorefrontsQuery,
  neighbourhood,
  storefrontsInBoundsQuery,
  TORONTO_CENTROID,
  type MapBounds,
} from "@/lib/search-data";
import { usePatientLocation } from "@/lib/patient-location";
import { SearchMap } from "@/components/treatme/SearchMap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search/map")({
  head: () => ({
    meta: [
      { title: "map view · treatme" },
      {
        name: "description",
        content: "every treatme medspa on the map, with the providers working at each one.",
      },
      { property: "og:title", content: "map view · treatme" },
      {
        property: "og:description",
        content: "every treatme medspa on the map, with the providers working at each one.",
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
      <h1 className="brand-display text-[24px]">couldn't load the map.</h1>
      <p className="text-[13px] text-ink-mute mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10">nothing here.</div>,
  component: MapView,
});

function MapView() {
  const { data } = useSuspenseQuery(directoryQuery);
  const { location: patientLocation } = usePatientLocation();
  const mapCenter = patientLocation
    ? { lat: patientLocation.lat, lng: patientLocation.lng }
    : TORONTO_CENTROID;
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState<MapBounds | null>(null);

  const pinned = useMemo(
    () => data.storefronts.filter((s) => typeof s.lat === "number" && typeof s.lng === "number"),
    [data.storefronts],
  );
  const { data: viewportData } = useQuery(storefrontsInBoundsQuery(viewport));
  const { data: nearby } = useQuery(
    nearbyStorefrontsQuery(patientLocation ? mapCenter : null, 500),
  );
  const kmById = useMemo(
    () => new Map((nearby ?? []).map((row) => [row.id, row.km])),
    [nearby],
  );
  const visiblePins = useMemo(() => {
    if (!viewportData) return pinned.slice(0, 300);
    const ids = new Set(viewportData.ids);
    return pinned.filter((storefront) => ids.has(storefront.id));
  }, [pinned, viewportData]);

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data.providers)
      for (const s of p.storefronts) counts[s.id] = (counts[s.id] ?? 0) + 1;
    return counts;
  }, [data.providers]);

  // the bottom sheet uses the same database bounds result as the pins.
  const inView = useMemo(() => {
    if (!viewport) return visiblePins;
    const midLat = (viewport.minLat + viewport.maxLat) / 2;
    const midLng = (viewport.minLng + viewport.maxLng) / 2;
    return [...visiblePins].sort(
        (a, b) =>
          (a.lat - midLat) ** 2 +
          (a.lng - midLng) ** 2 -
          ((b.lat - midLat) ** 2 + (b.lng - midLng) ** 2),
      );
  }, [visiblePins, viewport]);

  const areaLabel = useMemo(() => {
    const cities = new Set(inView.map((s) => s.city.toLowerCase()).filter(Boolean));
    if (cities.size === 0) return "this area";
    if (cities.size <= 2) return [...cities].join(" and ");
    return `${cities.size} areas`;
  }, [inView]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute inset-0">
        <ClientOnly fallback={<div className="size-full bg-muted" />}>
          <SearchMap
            storefronts={visiblePins}
            center={mapCenter}
            selectedId={selected}
            onSelect={setSelected}
            providerCounts={providerCounts}
            kmById={kmById}
            height="h-full"
            gestureHandling="greedy"
            onViewportChange={setViewport}
            className="rounded-none border-0"
          />
        </ClientOnly>
      </div>

      <button
        type="button"
        aria-label="go back"
        onClick={() => router.history.back()}
        className="absolute top-4 left-4 z-30 inline-flex items-center gap-1.5 rounded-pill bg-white/95 border border-line px-3.5 py-2 text-[12.5px] font-semibold lowercase shadow-sm"
      >
        <ArrowLeft className="size-3.5" /> back
      </button>

      {/* bottom sheet: everything currently in view */}
      <div className="absolute inset-x-0 bottom-0 z-30 max-h-[52%] overflow-y-auto rounded-t-[24px] border-t border-line bg-background px-5 pb-8 pt-3 shadow-[0_-8px_30px_rgba(17,17,17,0.08)]">
        <span
          aria-hidden
          className="mx-auto mb-3 block h-1 w-10 rounded-pill bg-[rgba(17,17,17,0.15)]"
        />
        <h1 className="brand-eyebrow">in this area</h1>


        <div className="mt-3 space-y-2">
          {inView.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[rgba(17,17,17,0.25)] p-4 text-[13px] text-ink-mute lowercase">
              no medspas in view. zoom out or pan to a busier area.
            </p>
          )}
          {inView.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              className={cn(
                "w-full text-left rounded-2xl border p-3.5 bg-white",
                selected === s.id ? "border-hot" : "border-line",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="brand-display text-[16px] truncate">{s.name}</p>
                {s.review_count ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[12px] text-ink-soft">
                    <Star className="size-3 fill-ink text-ink" />
                    {s.rating}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-pill bg-butter px-2 py-0.5 text-[10px] font-semibold lowercase">
                    new to treatme
                  </span>
                )}
              </div>
              <p className="text-[12px] text-ink-mute lowercase inline-flex items-center gap-1 mt-0.5">
                <MapPin className="size-3.5 text-hot" />
                {neighbourhood(s)} · {s.listed.length} treatment
                {s.listed.length === 1 ? "" : "s"}
              </p>
              <Link
                to="/storefront/$id"
                params={{ id: s.id }}
                className="mt-1.5 inline-block text-[12px] font-semibold text-hot lowercase"
              >
                view storefront
              </Link>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
