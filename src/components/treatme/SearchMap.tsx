import { useEffect, useMemo, useRef, useState } from "react";
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

interface Props {
  storefronts: Storefront[];
  center: LatLng;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SearchMap({ storefronts, center, selectedId, onSelect }: Props) {
  const [failed, setFailed] = useState(!BROWSER_KEY);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

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
          path: maps.SymbolPath.CIRCLE,
          scale: s.id === selectedId ? 10 : 7,
          fillColor: s.id === selectedId ? "#FF1F87" : "#111111",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
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

  if (!failed) {
    return <div ref={divRef} className="h-[320px] w-full rounded-2xl overflow-hidden border border-line" />;
  }

  // fallback schematic map: keeps the spatial read without a maps key.
  const pos = (p: LatLng) => {
    const spanLat = Math.max(bounds.maxLat - bounds.minLat, 0.005);
    const spanLng = Math.max(bounds.maxLng - bounds.minLng, 0.005);
    return {
      left: `${10 + ((p.lng - bounds.minLng) / spanLng) * 80}%`,
      top: `${10 + ((bounds.maxLat - p.lat) / spanLat) * 80}%`,
    };
  };

  return (
    <div className="relative h-[320px] w-full rounded-2xl overflow-hidden border border-line bg-mint/40">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #111 1px, transparent 1px), linear-gradient(to bottom, #111 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pos(center)}>
        <span className="block size-3 rounded-full bg-hot ring-4 ring-hot/25" />
      </div>
      {storefronts.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={pos({ lat: s.lat, lng: s.lng })}
        >
          <span
            className={cn(
              "block rounded-full px-2.5 py-1 text-[10px] font-semibold lowercase whitespace-nowrap shadow-sm border",
              s.id === selectedId ? "bg-hot text-white border-hot" : "bg-white text-ink border-line",
            )}
          >
            {s.name}
          </span>
        </button>
      ))}
      <p className="absolute bottom-2 left-3 text-[10px] text-ink-mute lowercase">
        approximate view. connect a maps key for the live map.
      </p>
    </div>
  );
}
