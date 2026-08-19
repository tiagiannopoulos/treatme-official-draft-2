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

  for (let page = 0; page < 5; page++) {
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

    // collect + dedupe by google place id
    const byId = new Map<string, Place>();
    const perQuery: Record<string, number> = {};
    for (const q of QUERIES) {
      const places = await searchAll(apiKey, q);
      perQuery[q] = places.length;
      for (const p of places) {
        if (p.id && p.location?.latitude && p.location?.longitude) byId.set(p.id, p);
      }
    }

    // fabricated data must go, along with the provider links pointing at it
    const { error: linkErr } = await supabase
      .from("provider_storefronts")
      .delete()
      .not("id", "is", null);
    if (linkErr) throw new Error(`clearing provider_storefronts: ${linkErr.message}`);

    const { error: delErr } = await supabase
      .from("storefronts")
      .delete()
      .not("id", "is", null);
    if (delErr) throw new Error(`clearing storefronts: ${delErr.message}`);

    const usedSlugs = new Set<string>();
    const rows = [...byId.values()].map((p) => {
      const name = p.displayName?.text ?? "unnamed clinic";
      let slug = slugify(name);
      let n = 2;
      while (usedSlugs.has(slug)) slug = `${slugify(name)}-${n++}`;
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
        hero_image_url: null,
        featured: false,
        claimed: false,
      };
    });

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { data, error } = await supabase
        .from("storefronts")
        .upsert(chunk, { onConflict: "google_place_id" })
        .select("id");
      if (error) throw new Error(`upsert: ${error.message}`);
      inserted += data?.length ?? 0;
    }

    return Response.json({
      ok: true,
      unique_places: byId.size,
      inserted,
      per_query: perQuery,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("seed-clinics error:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
