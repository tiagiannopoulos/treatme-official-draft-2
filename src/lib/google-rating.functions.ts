import { createServerFn } from "@tanstack/react-start";

/**
 * live google rating for a place. never written to the database, never cached server side,
 * and only the score and count are returned so no google review text can reach the ui.
 */
export const getGoogleRating = createServerFn({ method: "POST" })
  .inputValidator((data: { placeId: string }) => {
    const placeId = String(data?.placeId ?? "").trim();
    if (!placeId || placeId.length > 300) throw new Error("invalid place id");
    return { placeId };
  })
  .handler(async ({ data }): Promise<{ rating: number | null; count: number | null }> => {
    const key =
      process.env["GOOGLE_MAPS_API_KEY"] ??
      process.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] ??
      null;
    if (!key) return { rating: null, count: null };

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}`,
        {
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "rating,userRatingCount",
          },
        },
      );
      if (!res.ok) return { rating: null, count: null };
      const json = (await res.json()) as { rating?: number; userRatingCount?: number };
      return {
        rating: typeof json.rating === "number" ? json.rating : null,
        count: typeof json.userRatingCount === "number" ? json.userRatingCount : null,
      };
    } catch {
      return { rating: null, count: null };
    }
  });
