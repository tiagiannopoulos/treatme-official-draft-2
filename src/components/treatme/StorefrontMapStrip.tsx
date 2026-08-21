import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { loadGoogleMaps, MAP_STYLE, resolveBrowserKey, resolveTrackingId } from "@/lib/google-maps-loader";
import { accentTint, textOnAccent } from "@/lib/storefront-brand";


function pinIcon(accent: string): google.maps.Symbol {
  return {
    path: "M12 31C5 22.5 1 17.6 1 12A11 11 0 1 1 23 12c0 5.6-4 10.5-11 19z",
    fillColor: accent,
    fillOpacity: 1,
    strokeColor: "#FCFBF7",
    strokeWeight: 2,
    scale: 1.1,
    anchor: new google.maps.Point(12, 31),
  };
}

/**
 * one clinic pinned, with the distance from the patient floating in the middle.
 * tapping anywhere hands off to the device maps app.
 */
export function StorefrontMapStrip({
  lat,
  lng,
  accent,
  distanceLabel,
  mapsHref,
  name,
}: {
  lat: number;
  lng: number;
  accent: string;
  distanceLabel: string | null;
  mapsHref: string;
  name: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);

  // resolved client-side: VITE_GOOGLE_MAPS_API_KEY (vercel/self-host) first,
  // then the lovable connector key. null when neither is set.
  const browserKey = resolveBrowserKey();
  const trackingId = resolveTrackingId();

  useEffect(() => {
    if (!browserKey || !divRef.current || mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps(browserKey, trackingId)
      .then(() => {
        if (cancelled || !divRef.current) return;
        const map = new google.maps.Map(divRef.current, {
          center: { lat, lng },
          zoom: 14,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "none",
          keyboardShortcuts: false,
          styles: MAP_STYLE,
        });
        mapRef.current = map;
        new google.maps.Marker({ map, position: { lat, lng }, icon: pinIcon(accent), title: name });

        window.setTimeout(() => {
          if (cancelled) return;
          const broken = divRef.current?.querySelector(".gm-err-container, .gm-err-message");
          if (broken) setFailed(true);
        }, 1500);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [accent, browserKey, lat, lng, name, trackingId]);

  const live = Boolean(browserKey) && !failed;

  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noreferrer"
      aria-label={`open ${name} in maps`}
      className="relative block h-[160px] w-full overflow-hidden rounded-[18px] border border-line"
      style={{ backgroundColor: accentTint(accent, 0.18) }}
    >
      {live ? (
        <div ref={divRef} className="h-full w-full" />
      ) : (
        <span className="grid h-full w-full place-items-center">
          <span
            className="grid size-11 place-items-center rounded-full"
            style={{ backgroundColor: accent, color: textOnAccent(accent) }}
          >
            <MapPin className="size-5" />
          </span>
        </span>
      )}

      {distanceLabel && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[8px] bg-cream px-2.5 py-1 text-[13px] font-medium lowercase text-ink">
          {distanceLabel}
        </span>
      )}
    </a>
  );
}
