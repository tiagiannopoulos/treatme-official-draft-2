import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { Maximize2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGoogleMapsKey } from "@/lib/map.functions";
import type { LatLng, Storefront } from "@/lib/search-data";
import { loadGoogleMaps } from "@/lib/google-maps-loader";


const HOT = "#FF1F87";
const INK = "#111111";
const CREAM = "#FCFBF7";

const keyQuery = {
  queryKey: ["google-maps-key"],
  queryFn: () => getGoogleMapsKey(),
  staleTime: Infinity,
  retry: false,
} as const;

/** suppress poi and transit labels for a clean, editorial look. */
const LOCAL_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

interface Props {
  storefronts: Storefront[];
  center: LatLng;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** number of providers working at each storefront, keyed by storefront id. */
  providerCounts?: Record<string, number>;
  /** when set, draws the search radius and frames the map to it. */
  radiusKm?: number;
  height?: string;
  /** shows the expand button that pushes to the full screen map. */
  expandable?: boolean;
  /** cooperative keeps the page scrolling inside the small card; greedy suits full screen. */
  gestureHandling?: "greedy" | "cooperative";
  className?: string;
}

export function SearchMap({
  storefronts,
  center,
  selectedId,
  onSelect,
  providerCounts = {},
  radiusKm,
  height = "h-[220px]",
  expandable = false,
  gestureHandling = "cooperative",
  className,
}: Props) {

  const { data } = useQuery(keyQuery);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const selected = storefronts.find((s) => s.id === selectedId) ?? null;

  const browserKey = data?.browserKey ?? null;
  const trackingId = data?.trackingId ?? null;

  // load google maps once, then init the map instance.
  useEffect(() => {
    if (!browserKey || !divRef.current || mapRef.current) return;
    let cancelled = false;

    // google maps calls this global when the key is rejected or restricted.
    (window as any).gm_authFailure = () => {
      if (!cancelled) setFailed(true);
    };

    loadGoogleMaps(browserKey, trackingId)
      .then(() => {
        if (cancelled || !divRef.current) return;
        const map = new google.maps.Map(divRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling,
          styles: LOCAL_MAP_STYLE,
          mapTypeId: "roadmap",
        });
        mapRef.current = map;

        map.addListener("click", () => onSelect(null));

        setReady(true);

        // referrer-restricted keys render an error overlay instead of tiles.
        // if the overlay appears, fall back to the spatial placeholder.
        window.setTimeout(() => {
          if (cancelled) return;
          const hasErrorOverlay = divRef.current?.querySelector(".gm-err-container, .gm-err-message") !== null;
          if (hasErrorOverlay) setFailed(true);
        }, 1500);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      clustererRef.current?.clearMarkers();
      clustererRef.current?.setMap(null);
      clustererRef.current = null;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      mapRef.current = null;
    };
  }, [browserKey, trackingId, onSelect, gestureHandling]);

  // remove google maps error overlay if the key is restricted and we fall back.
  useEffect(() => {
    if (!failed) return;
    const removeOverlay = () => {
      document.querySelectorAll(".gm-err-container, .gm-err-content, .gm-err-icon, .gm-err-title, .gm-err-message").forEach((el) => {
        (el as HTMLElement).style.display = "none";
        el.remove();
      });
    };
    removeOverlay();
    const observer = new MutationObserver(() => removeOverlay());
    observer.observe(document.body, { childList: true, subtree: true });
    const id = window.setInterval(removeOverlay, 300);
    return () => {
      observer.disconnect();
      window.clearInterval(id);
    };
  }, [failed]);

  // create markers when the map is ready or the storefront list changes.
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const map = mapRef.current;
    const markers: google.maps.Marker[] = [];
    storefronts.forEach((s) => {
      const marker = new google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        icon: createPinIcon(false),
        title: s.name,
      });
      marker.addListener("click", () => {
        const current = selectedIdRef.current;
        onSelect(s.id === current ? null : s.id);
      });
      markers.push(marker);
    });
    markersRef.current = markers;

    // cluster pins so the gta reads clean when zoomed out.
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        renderer: {
          render: ({ count, position }) =>
            new google.maps.Marker({
              position,
              icon: createClusterIcon(count),
              label: {
                text: String(count),
                color: CREAM,
                fontSize: "12px",
                fontWeight: "600",
              },
              zIndex: 200,
            }),
        },
      });
    }
    clustererRef.current.addMarkers(markers);

    return () => {
      clustererRef.current?.clearMarkers();
    };
  }, [storefronts, ready, onSelect]);


  // update marker icons when selection changes.
  useEffect(() => {
    if (!ready) return;
    markersRef.current.forEach((marker, idx) => {
      const s = storefronts[idx];
      if (!s) return;
      marker.setIcon(createPinIcon(s.id === selectedId));
      marker.setZIndex(s.id === selectedId ? 100 : 1);
    });
  }, [selectedId, ready, storefronts]);

  // keep the map framed on the search location and its radius.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const point = { lat: center.lat, lng: center.lng };

    if (typeof radiusKm === "number") {
      if (!circleRef.current) {
        circleRef.current = new google.maps.Circle({
          map,
          strokeColor: HOT,
          strokeOpacity: 0.55,
          strokeWeight: 1.5,
          fillColor: HOT,
          fillOpacity: 0.06,
          clickable: false,
        });
      }
      circleRef.current.setCenter(point);
      circleRef.current.setRadius(radiusKm * 1000);
      const bounds = circleRef.current.getBounds();
      if (bounds) map.fitBounds(bounds, 12);
      return;
    }

    if (storefronts.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      storefronts.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      map.fitBounds(bounds, 40);
      return;
    }
    map.panTo(point);
  }, [center.lat, center.lng, ready, radiusKm, storefronts]);


  const usingGoogleMaps = Boolean(browserKey) && !failed;

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
            usingGoogleMaps
              ? "left-1/2 top-3 -translate-x-1/2"
              : flipBelow
                ? "translate-y-2"
                : "-translate-y-[calc(100%+30px)]",
          )}
          style={
            !usingGoogleMaps && selectedPos
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

  if (usingGoogleMaps) {
    return (
      <div className={cn("relative w-full rounded-[20px] overflow-hidden border border-line", height, className)}>
        <div ref={divRef} className="absolute inset-0" />
        {chrome}
      </div>
    );
  }

  // no key yet, or google maps could not start: mint placeholder that still reads spatially.
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
      <p className="absolute bottom-3 left-3 text-[10px] text-ink-mute lowercase">map loading</p>
    </div>
  );
}

/** hot pink cluster bubble so clusters stay on brand. */
function createClusterIcon(count: number): google.maps.Icon {
  const size = count > 50 ? 52 : count > 20 ? 46 : 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="${HOT}" fill-opacity="0.92" stroke="${CREAM}" stroke-width="2.5"/></svg>`;
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
    labelOrigin: new google.maps.Point(20, 20),
  };
}

function createPinIcon(active: boolean): google.maps.Icon {
  const size = active ? 26 : 21;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.33)}" viewBox="0 0 24 32" fill="none"><path d="M12 31C5 22.5 1 17.6 1 12A11 11 0 1 1 23 12c0 5.6-4 10.5-11 19z" fill="${active ? INK : HOT}" stroke="#FCFBF7" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="#FCFBF7"/></svg>`;
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, Math.round(size * 1.33)),
    anchor: new google.maps.Point(size / 2, Math.round(size * 1.33)),
  };
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
        to="/storefront/$id"
        params={{ id: storefront.id }}

        className="mt-2 inline-block text-[12px] font-semibold text-hot lowercase"
      >
        view storefront
      </Link>
    </div>
  );
}
