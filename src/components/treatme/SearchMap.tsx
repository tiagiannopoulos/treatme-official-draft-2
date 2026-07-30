import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMapboxToken } from "@/lib/map.functions";
import type { LatLng, Storefront } from "@/lib/search-data";

/** light, minimal basemap with no poi clutter. */
const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const HOT = "#FF1F87";
const INK = "#111111";

const tokenQuery = {
  queryKey: ["mapbox-token"],
  queryFn: () => getMapboxToken(),
  staleTime: Infinity,
  retry: false,
} as const;

interface Props {
  storefronts: Storefront[];
  center: LatLng;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** number of providers working at each storefront, keyed by storefront id. */
  providerCounts?: Record<string, number>;
  height?: string;
  /** shows the expand button that pushes to the full screen map. */
  expandable?: boolean;
  className?: string;
}

export function SearchMap({
  storefronts,
  center,
  selectedId,
  onSelect,
  providerCounts = {},
  height = "h-[220px]",
  expandable = false,
  className,
}: Props) {
  const { data, isLoading } = useQuery(tokenQuery);
  const token = data?.token ?? null;
  const [failed, setFailed] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  const selected = storefronts.find((s) => s.id === selectedId) ?? null;

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: storefronts.map((s) => ({
        type: "Feature" as const,
        id: s.id,
        properties: { id: s.id, name: s.name },
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
      })),
    }),
    [storefronts],
  );

  // boot mapbox gl only in the browser, only once we have a token.
  useEffect(() => {
    if (!token || !divRef.current || mapRef.current) return;
    let cancelled = false;
    let map: any = null;

    (async () => {
      try {
        const mod = await import("mapbox-gl");
        const mapboxgl = (mod as any).default ?? mod;
        if (cancelled || !divRef.current) return;
        mapboxgl.accessToken = token;
        map = new mapboxgl.Map({
          container: divRef.current,
          style: MAP_STYLE,
          center: [center.lng, center.lat],
          zoom: 11,
          attributionControl: false,
        });
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          map.addSource("storefronts", {
            type: "geojson",
            data: geojson,
            cluster: true,
            clusterRadius: 46,
            clusterMaxZoom: 11,
          });

          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "storefronts",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": HOT,
              "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 25, 28],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FCFBF7",
            },
          });
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "storefronts",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            },
            paint: { "text-color": "#FCFBF7" },
          });
          map.addLayer({
            id: "pins",
            type: "circle",
            source: "storefronts",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": HOT,
              "circle-radius": 8,
              "circle-stroke-width": 2.5,
              "circle-stroke-color": "#FCFBF7",
            },
          });
          map.addLayer({
            id: "pin-selected",
            type: "circle",
            source: "storefronts",
            filter: ["==", ["get", "id"], selectedId ?? "__none__"],
            paint: {
              "circle-color": INK,
              "circle-radius": 11,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#FCFBF7",
            },
          });

          map.on("click", "pins", (e: any) => {
            const id = e.features?.[0]?.properties?.id;
            if (id) onSelect(id);
          });
          map.on("click", "clusters", (e: any) => {
            const feature = e.features?.[0];
            const clusterId = feature?.properties?.cluster_id;
            const source = map.getSource("storefronts");
            source?.getClusterExpansionZoom?.(clusterId, (err: any, zoom: number) => {
              if (err) return;
              map.easeTo({ center: feature.geometry.coordinates, zoom });
            });
          });
          map.on("click", (e: any) => {
            const hits = map.queryRenderedFeatures(e.point, { layers: ["pins", "clusters"] });
            if (!hits.length) onSelect(null);
          });
          for (const layer of ["pins", "clusters"]) {
            map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
          }

          readyRef.current = true;
          setReady(true);
        });

        map.on("error", () => setFailed(true));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      mapRef.current = null;
      map?.remove();
    };
  }, [token]);

  // keep pins in sync with the filtered results.
  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource("storefronts")?.setData(geojson);
  }, [geojson, ready]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.setFilter("pin-selected", ["==", ["get", "id"], selectedId ?? "__none__"]);
  }, [selectedId, ready]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [center.lat, center.lng, ready]);

  const usingMapbox = Boolean(token) && !failed;

  const bounds = useMemo(() => {
    const lats = storefronts.map((s) => s.lat).concat(center.lat);
    const lngs = storefronts.map((s) => s.lng).concat(center.lng);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [storefronts, center]);

  const raw = (p: LatLng) => {
    const spanLat = Math.max(bounds.maxLat - bounds.minLat, 0.005);
    const spanLng = Math.max(bounds.maxLng - bounds.minLng, 0.005);
    return {
      left: 12 + ((p.lng - bounds.minLng) / spanLng) * 76,
      top: 18 + ((bounds.maxLat - p.lat) / spanLat) * 66,
    };
  };

  const pos = (p: LatLng) => {
    const { left, top } = raw(p);
    return { left: `${left}%`, top: `${top}%` };
  };

  const selectedPos = selected ? raw({ lat: selected.lat, lng: selected.lng }) : null;
  /** flip the card below the pin when there is no room above it inside the card. */
  const flipBelow = selectedPos !== null && selectedPos.top < 55;

  const chrome = (
    <>
      {selected && (
        <div
          className={cn(
            "absolute z-20 w-[212px]",
            usingMapbox
              ? "left-1/2 top-3 -translate-x-1/2"
              : flipBelow
                ? "translate-y-2"
                : "-translate-y-[calc(100%+30px)]",
          )}
          style={
            !usingMapbox && selectedPos
              ? {
                  top: `${selectedPos.top}%`,
                  left: `${Math.min(Math.max(selectedPos.left, 4), 96)}%`,
                  transform: `translateX(-${Math.min(Math.max(selectedPos.left, 4), 96) > 60 ? 80 : 20}%) ${
                    flipBelow ? "translateY(8px)" : "translateY(calc(-100% - 30px))"
                  }`,
                }
              : undefined
          }
        >
          <StorefrontPopover storefront={selected} providerCount={providerCounts[selected.id] ?? 0} />
        </div>
      )}

      {expandable && (
        <Link
          to="/search/map"
          aria-label="open full screen map"
          className="absolute bottom-3 right-3 z-20 grid size-9 place-items-center rounded-full bg-white/95 border border-line shadow-sm"
        >
          <Maximize2 className="size-4 text-ink" />
        </Link>
      )}
    </>
  );

  if (usingMapbox) {
    return (
      <div className={cn("relative w-full rounded-[20px] overflow-hidden border border-line", height, className)}>
        <div ref={divRef} className="absolute inset-0" />
        {chrome}
      </div>
    );
  }

  // no token yet, or mapbox could not start: mint placeholder that still reads spatially.
  return (
    <div
      className={cn("relative w-full rounded-[20px] overflow-hidden border border-line bg-mint", height, className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #111 1px, transparent 1px), linear-gradient(to bottom, #111 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      {storefronts.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id === selectedId ? null : s.id)}
          aria-label={s.name}
          className="absolute z-10 -translate-x-1/2 -translate-y-full"
          style={pos({ lat: s.lat, lng: s.lng })}
        >
          <Teardrop active={s.id === selectedId} />
        </button>
      ))}
      {chrome}
      <p className="absolute bottom-3 left-3 text-[10px] text-ink-mute lowercase">
        {isLoading ? "map loading" : "map loading"}
      </p>
    </div>
  );
}

function Teardrop({ active }: { active: boolean }) {
  return (
    <svg
      width={active ? 26 : 21}
      height={active ? 34 : 27}
      viewBox="0 0 24 32"
      fill="none"
      className="drop-shadow-sm"
    >
      <path
        d="M12 31C5 22.5 1 17.6 1 12A11 11 0 1 1 23 12c0 5.6-4 10.5-11 19z"
        fill={HOT}
        stroke="#fff"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="3.6" fill="#fff" />
    </svg>
  );
}

export function StorefrontPopover({
  storefront,
  providerCount,
}: {
  storefront: Storefront;
  providerCount: number;
}) {
  const isNew = !storefront.review_count;
  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-lg">
      <p className="brand-display text-[15px] leading-tight truncate">{storefront.name}</p>
      <p className="text-[11px] text-ink-mute lowercase truncate">{storefront.city.toLowerCase()}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[11px] text-ink-soft lowercase">
          {providerCount} provider{providerCount === 1 ? "" : "s"}
        </span>
        {isNew ? (
          <span className="rounded-pill bg-butter px-2 py-0.5 text-[10px] font-semibold lowercase">
            new to treatme
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
            <Star className="size-3 fill-ink text-ink" />
            {storefront.rating}
          </span>
        )}
      </div>
      <Link
        to="/medspas/$slug"
        params={{ slug: storefront.slug }}
        className="mt-2 inline-block text-[12px] font-semibold text-hot lowercase"
      >
        view storefront
      </Link>
    </div>
  );
}
