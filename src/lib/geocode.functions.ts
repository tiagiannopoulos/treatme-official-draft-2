import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * turns a postal code, neighbourhood or city into a point. the google key
 * stays on the server, the browser only ever sees the resolved place.
 */
export const geocodePlace = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ query: z.string().min(2).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const key =
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.GOOGLE_MAPS_API_KEY_1 ??
      process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_API_KEY ??
      process.env.GOOGLE_MAPS_BROWSER_KEY ??
      process.env.GOOGLE_MAPS_BROWSER_KEY_1 ??
      process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ??
      null;
    if (!key) return { ok: false as const, reason: "no_key" as const };

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", data.query);
    url.searchParams.set("region", "ca");
    url.searchParams.set("key", key);

    const res = await fetch(url.toString());
    if (!res.ok) return { ok: false as const, reason: "request_failed" as const };
    const body = (await res.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };

    const hit = body.results?.[0];
    const lat = hit?.geometry?.location?.lat;
    const lng = hit?.geometry?.location?.lng;
    if (!hit || typeof lat !== "number" || typeof lng !== "number") {
      return { ok: false as const, reason: "not_found" as const };
    }

    // prefer neighbourhood or town over the full postal address, it reads better in a chip
    const parts = hit.address_components ?? [];
    const pick = (type: string) => parts.find((p) => p.types.includes(type))?.long_name ?? null;
    const area =
      pick("neighborhood") ?? pick("sublocality") ?? pick("locality") ?? pick("postal_town") ?? null;
    const region = pick("administrative_area_level_1");
    const label = (area ? (region ? `${area}, ${region}` : area) : hit.formatted_address ?? data.query)
      .toLowerCase()
      .replace(/[\u2010-\u2015-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return { ok: true as const, lat, lng, label };
  });
