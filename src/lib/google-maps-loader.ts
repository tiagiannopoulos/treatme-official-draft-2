/**
 * loads the google maps js api once per page. shared by the search map and the
 * storefront map strip so the script is never injected twice.
 */
let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(browserKey: string, trackingId: string | null): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (typeof window.google === "object" && typeof window.google.maps === "object") {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "treatmeGoogleMapsInit";
    (window as any)[callbackName] = () => {
      resolve();
      delete (window as any)[callbackName];
    };
    const script = document.createElement("script");
    const channel = encodeURIComponent(trackingId ?? "treatme");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}&loading=async&callback=${callbackName}&channel=${channel}`;
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
