import { createServerFn } from "@tanstack/react-start";

/**
 * hands the browser the Google Maps browser key and tracking id.
 * both are read from connector env vars so they never reach the client bundle.
 */
export const getGoogleMapsKey = createServerFn({ method: "GET" }).handler(async () => {
  const browserKey =
    process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ??
    process.env.GOOGLE_MAPS_BROWSER_KEY ??
    null;
  const trackingId =
    process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID ??
    process.env.GOOGLE_MAPS_TRACKING_ID ??
    null;

  return {
    browserKey: browserKey && browserKey.startsWith("AIza") ? browserKey : null,
    trackingId: trackingId ? trackingId : null,
  };
});
