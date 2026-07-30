import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Maximize2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LatLng, Storefront } from "@/lib/search-data";

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

declare global {
  interface Window {
    google?: any;
    __treatmeMapReady?: () => void;
  }
}

function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("treatme-gmaps") as HTMLScriptElement | null;
    const done = () => (window.google?.maps ? resolve(window.google.maps) : reject(new Error("maps failed")));
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("maps failed")));
      return;
    }
    window.__treatmeMapReady = () => resolve(window.google.maps);
    const s = document.createElement("script");
    s.id = "treatme-gmaps";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__treatmeMapReady${
      TRACKING_ID ? `&channel=${TRACKING_ID}` : ""
    }`;
    s.onerror = () => reject(new Error("maps failed"));
    document.head.appendChild(s);
  });
}

/** bubblegum-hot teardrop pin, drawn as an svg path for google markers. */
const TEARDROP =
  "M 0 0 C -6 -9 -10 -13 -10 -19 A 10 10 0 1 1 10 -19 C 10 -13 6 -9 0 0 z";

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
  const [failed, setFailed] = useState(!BROWSER_KEY);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const selected = storefronts.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (!BROWSER_KEY || !divRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !divRef.current) return;
        mapRef.current = new maps.Map(divRef.current, {
          center,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
        });
        mapRef.current.addListener("click", () => onSelect(null));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const maps = window.google?.maps;
    if (!maps || !mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = storefronts.map((s) => {
      const marker = new maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        map: mapRef.current,
        title: s.name,
        icon: {
          path: TEARDROP,
          scale: s.id === selectedId ? 1.25 : 1,
          fillColor: "#FF1F87",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          anchor: new maps.Point(0, 0),
        },
      });
      marker.addListener("click", () => onSelect(s.id));
      return marker;
    });
  }, [storefronts, selectedId, failed]);

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

  const pos = (p: LatLng) => {
    const spanLat = Math.max(bounds.maxLat - bounds.minLat, 0.005);
    const spanLng = Math.max(bounds.maxLng - bounds.minLng, 0.005);
    return {
      left: `${12 + ((p.lng - bounds.minLng) / spanLng) * 76}%`,
      top: `${18 + ((bounds.maxLat - p.lat) / spanLat) * 66}%`,
    };
  };

  const chrome = (
    <>
      {selected && (
        <div
          className={cn(
            "absolute z-20 -translate-x-1/2 w-[212px]",
            failed ? "-translate-y-[calc(100%+18px)]" : "left-1/2 top-3",
          )}
          style={failed ? pos({ lat: selected.lat, lng: selected.lng }) : undefined}
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

  if (!failed) {
    return (
      <div className={cn("relative w-full rounded-[20px] overflow-hidden border border-line", height, className)}>
        <div ref={divRef} className="absolute inset-0" />
        {chrome}
      </div>
    );
  }

  // fallback schematic map: keeps the spatial read without a maps key.
  return (
    <div
      className={cn("relative w-full rounded-[20px] overflow-hidden border border-line bg-mint/40", height, className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
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
      <p className="absolute bottom-3 left-3 text-[10px] text-ink-mute lowercase">approximate view.</p>
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
        fill="#FF1F87"
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
