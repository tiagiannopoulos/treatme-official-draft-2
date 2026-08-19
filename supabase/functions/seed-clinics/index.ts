// one time seeding function: replaces fabricated storefronts with real toronto
// med spas from google places text search (new).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

// google text search returns at most 60 results per query, so coverage comes from
// slicing the gta by neighbourhood and by treatment type rather than by city alone.
const AREAS = [
  "Toronto, Ontario",
  "downtown Toronto, Ontario",
  "midtown Toronto, Ontario",
  "Yorkville, Toronto",
  "Queen West, Toronto",
  "King West, Toronto",
  "Liberty Village, Toronto",
  "Leslieville, Toronto",
  "The Beaches, Toronto",
  "Yonge and Eglinton, Toronto",
  "Forest Hill, Toronto",
  "Rosedale, Toronto",
  "Annex, Toronto",
  "East York, Ontario",
  "North York, Ontario",
  "Willowdale, North York, Ontario",
  "Yonge and Sheppard, North York, Ontario",
  "Yonge and Finch, North York, Ontario",
  "Bayview Village, North York, Ontario",
  "Don Mills, North York, Ontario",
  "York Mills, North York, Ontario",
  "Lawrence Park, Toronto, Ontario",
  "Downsview, North York, Ontario",
  "Bathurst and Steeles, North York, Ontario",
  "Yorkdale, North York, Ontario",
  "North York Centre, Ontario",
  "Etobicoke, Ontario",
  "Mimico, Etobicoke, Ontario",
  "Islington Village, Etobicoke, Ontario",
  "Scarborough, Ontario",
  "Agincourt, Scarborough, Ontario",
  "Mississauga, Ontario",
  "Port Credit, Mississauga, Ontario",
  "Brampton, Ontario",
  "Vaughan, Ontario",
  "Woodbridge, Vaughan, Ontario",
  "Thornhill, Ontario",
  "Richmond Hill, Ontario",
  "Markham, Ontario",
  "Unionville, Markham, Ontario",
  "Aurora, Ontario",
  "Newmarket, Ontario",
  "Oakville, Ontario",
  "Burlington, Ontario",
  "Milton, Ontario",
  "Pickering, Ontario",
  "Ajax, Ontario",
  "Whitby, Ontario",
  "Oshawa, Ontario",
];

const KINDS = [
  "med spa",
  "medical aesthetics clinic",
  "botox clinic",
  "laser hair removal clinic",
  "skin clinic",
  "cosmetic injectables clinic",
];

const QUERIES = AREAS.flatMap((area) => KINDS.map((kind) => `${kind} in ${area}`));

const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.websiteUri,nextPageToken";

const REFERER =
  "https://id-preview--c243e9e9-f41e-403c-830f-ae4f44358a6d.lovable.app/";

interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  websiteUri?: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "clinic";
}

/** "123 Queen St W, Toronto, ON M5H 2M9, Canada" -> "Toronto" */
function cityFrom(address: string | undefined): string {
  if (!address) return "Toronto";
  const parts = address.split(",").map((p) => p.trim());
  const provinceIdx = parts.findIndex((p) => /^(ON|Ontario)\b/i.test(p));
  if (provinceIdx > 0) return parts[provinceIdx - 1];
  return parts.length > 1 ? parts[1] : "Toronto";
}

function postcodeFrom(address: string | undefined): string {
  const m = address?.match(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/);
  return m ? m[0] : "";
}

async function searchAll(apiKey: string, textQuery: string): Promise<Place[]> {
  const out: Place[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // the managed key is browser-referrer restricted to this project's origin
        Referer: REFERER,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`places search failed (${res.status}): ${await res.text()}`);
    }

    const json = (await res.json()) as { places?: Place[]; nextPageToken?: string };
    out.push(...(json.places ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
    // page tokens need a brief delay before they resolve
    await new Promise((r) => setTimeout(r, 1200));
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  try {
    const apiKey =
      Deno.env.get("GOOGLE_MAPS_BROWSER_KEY") ?? Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) throw new Error("missing google maps key");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // batching: the caller walks the query list a slice at a time so a run fits in
    // the function timeout. { from, to } are indexes into QUERIES.
    let from = 0;
    let to = QUERIES.length;
    if (req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { from?: number; to?: number };
      if (typeof body.from === "number") from = Math.max(0, body.from);
      if (typeof body.to === "number") to = Math.min(QUERIES.length, body.to);
    }
    const slice = QUERIES.slice(from, to);

    // collect + dedupe by google place id
    const byId = new Map<string, Place>();
    const failed: string[] = [];
    for (const q of slice) {
      try {
        const places = await searchAll(apiKey, q);
        for (const p of places) {
          if (p.id && p.location?.latitude && p.location?.longitude) byId.set(p.id, p);
        }
      } catch (e) {
        failed.push(`${q}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    // additive only. existing listings, claims and provider links are never deleted.
    const { data: existing, error: exErr } = await supabase
      .from("storefronts")
      .select("slug, google_place_id");
    if (exErr) throw new Error(`reading storefronts: ${exErr.message}`);

    const slugByPlace = new Map<string, string>();
    const usedSlugs = new Set<string>();
    for (const row of existing ?? []) {
      if (row.slug) usedSlugs.add(row.slug);
      if (row.google_place_id && row.slug) slugByPlace.set(row.google_place_id, row.slug);
    }

    // a place we already hold keeps whatever the clinic or an editor has since put on it
    const rows = [...byId.values()].filter((p) => !slugByPlace.has(p.id)).map((p) => {
      const name = p.displayName?.text ?? "unnamed clinic";
      // an already seeded place keeps its slug so links out in the app stay valid
      let slug = slugByPlace.get(p.id);
      if (!slug) {
        slug = slugify(name);
        let n = 2;
        while (usedSlugs.has(slug)) slug = `${slugify(name)}-${n++}`;
      }
      usedSlugs.add(slug);

      return {
        google_place_id: p.id,
        slug,
        name,
        tagline: "",
        address_line: p.formattedAddress ?? "",
        city: cityFrom(p.formattedAddress),
        postcode: postcodeFrom(p.formattedAddress),
        lat: p.location!.latitude!,
        lng: p.location!.longitude!,
        featured: false,
        claimed: false,
      };
    });

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { data, error } = await supabase
        .from("storefronts")
        .upsert(chunk, { onConflict: "google_place_id" })
        .select("id");
      if (error) throw new Error(`upsert: ${error.message}`);
      upserted += data?.length ?? 0;
    }

    const { count } = await supabase
      .from("storefronts")
      .select("id", { count: "exact", head: true });

    return Response.json({
      ok: true,
      queries_run: slice.length,
      query_range: { from, to, total: QUERIES.length },
      unique_places: byId.size,
      upserted,
      total_storefronts: count ?? null,
      failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("seed-clinics error:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
