/**
 * loads the google maps js api once per page. shared by the search map and the
 * storefront map strip so the script is never injected twice.
 *
 * the browser key is resolved client-side so the map works on self-hosted
 * deploys (e.g. vercel via github) that only set VITE_GOOGLE_MAPS_API_KEY,
 * while still falling back to the lovable-managed connector key in the hosted
 * preview. if neither key is present, loadGoogleMaps rejects instead of
 * crashing, so callers can render a placeholder.
 */
let loadPromise: Promise<void> | null = null;

const ENV = import.meta.env as Record<string, string | undefined>;

/**
 * resolve the maps browser key in priority order:
 *   1. VITE_GOOGLE_MAPS_API_KEY — user-supplied, present on vercel / self-host
 *   2. VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY — lovable managed connector
 * returns null when neither is set so callers can render a placeholder.
 */
export function resolveBrowserKey(): string | null {
  const direct = ENV.VITE_GOOGLE_MAPS_API_KEY;
  if (direct && direct.startsWith("AIza")) return direct;
  const connector = ENV.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (connector && connector.startsWith("AIza")) return connector;
  return null;
}

/** tracking id is lovable-connector only; absent on self-host, which is fine. */
export function resolveTrackingId(): string | null {
  const id = ENV.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  return id ? id : null;
}

let missingWarned = false;

export function loadGoogleMaps(
  browserKey?: string | null,
  trackingId?: string | null,
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (typeof window.google === "object" && typeof window.google.maps === "object") {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  const key = browserKey || resolveBrowserKey();
  if (!key) {
    if (!missingWarned) {
      missingWarned = true;
      // surface exactly which env vars were checked so it's easy to fix.
      console.warn(
        "[treatme] google maps browser key missing — neither VITE_GOOGLE_MAPS_API_KEY" +
          " nor VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY is set. rendering the" +
          " map placeholder instead of loading tiles.",
      );
    }
    return Promise.reject(new Error("google maps browser key missing"));
  }

  const channel = encodeURIComponent(trackingId || resolveTrackingId() || "treatme");

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "treatmeGoogleMapsInit";
    (window as any)[callbackName] = () => {
      resolve();
      delete (window as any)[callbackName];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callbackName}&channel=${channel}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Google Maps script failed to load"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export const googleMapsKeyQuery = {
  queryKey: ["google-maps-key"],
  staleTime: Infinity,
  retry: false,
} as const;

/** poi and transit labels off for a clean, editorial look. */
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];
