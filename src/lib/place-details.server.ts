/**
 * websites come from google places details. we only keep the fields that make a
 * listing useful: the site we are allowed to read and the phone.
 *
 * the maps key this project exposes is browser referrer restricted, so a server
 * side call must send a Referer google recognises or every request comes back
 * 403 "requests from referer <empty> are blocked". that silent 403 is why the
 * website column stayed empty and the crawler never had anything to read.
 */
export interface BackfillResult {
  considered: number;
  remaining: number;
  updated: number;
  no_website: number;
  failed: number;
  key_used: string;
  errors: string[];
}

const REFERER = "https://id-preview--c243e9e9-f41e-403c-830f-ae4f44358a6d.lovable.app/";
const MAX_ERRORS = 5;
const PROBE_PLACE = "ChIJN1t_tDeuEmsRUsoyG83frY4";

interface PlacesKey {
  key: string;
  /** browser keys are locked to an origin, so we have to send a Referer google knows. */
  referrer_restricted: boolean;
  label: string;
}

/** every key this runtime might hold, in the order worth trying. */
function keyCandidates(): PlacesKey[] {
  const out: PlacesKey[] = [];
  const push = (key: string | undefined, referrer_restricted: boolean, label: string) => {
    if (key && !out.some((c) => c.key === key)) out.push({ key, referrer_restricted, label });
  };
  push(process.env["GOOGLE_MAPS_API_KEY"], false, "GOOGLE_MAPS_API_KEY");
  push(process.env["GOOGLE_MAPS_BROWSER_KEY"], true, "GOOGLE_MAPS_BROWSER_KEY");
  push(process.env["VITE_GOOGLE_MAPS_API_KEY"], true, "VITE_GOOGLE_MAPS_API_KEY");
  push(
    process.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"],
    true,
    "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY",
  );
  return out;
}

function detailsRequest(placeId: string, candidate: PlacesKey): Promise<Response> {
  return fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": candidate.key,
      "X-Goog-FieldMask": "websiteUri,nationalPhoneNumber",
      ...(candidate.referrer_restricted ? { Referer: REFERER } : {}),
    },
  });
}

/** one probe per run: keys in this project differ in whether google accepts them at all. */
async function pickKey(): Promise<{ candidate: PlacesKey | null; tried: string[] }> {
  const tried: string[] = [];
  for (const candidate of keyCandidates()) {
    try {
      const res = await detailsRequest(PROBE_PLACE, candidate);
      if (res.ok) return { candidate, tried };
      tried.push(`${candidate.label} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      tried.push(`${candidate.label} threw: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  return { candidate: null, tried };
}


export async function backfillWebsites(limit = 100): Promise<BackfillResult> {
  const { candidate: chosen, tried } = await pickKey();
  if (!chosen) {
    throw new Error(
      tried.length
        ? `google rejected every maps key on the server. ${tried.join(" | ")}`
        : "no google places key on the server",
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("storefronts")
    .select("id, google_place_id, phone")
    .is("website", null)
    .not("google_place_id", "is", null)
    .limit(limit);
  if (error) throw new Error(error.message);

  const { count: remaining } = await supabaseAdmin
    .from("storefronts")
    .select("id", { count: "exact", head: true })
    .is("website", null)
    .not("google_place_id", "is", null);

  const out: BackfillResult = {
    considered: (rows ?? []).length,
    remaining: remaining ?? 0,
    updated: 0,
    no_website: 0,
    failed: 0,
    key_used: chosen.label,
    errors: [],
  };

  const note = (message: string) => {
    if (out.errors.length < MAX_ERRORS && !out.errors.includes(message)) out.errors.push(message);
  };

  for (const row of rows ?? []) {
    try {
      const res = await detailsRequest(row.google_place_id!, chosen);

      if (!res.ok) {
        out.failed += 1;
        note(`places details ${res.status}: ${(await res.text()).slice(0, 300)}`);
        continue;
      }
      const json = (await res.json()) as { websiteUri?: string; nationalPhoneNumber?: string };
      const website = typeof json.websiteUri === "string" ? json.websiteUri : null;
      if (!website) {
        out.no_website += 1;
        continue;
      }
      const patch: { website: string; phone?: string } = { website };
      if (!row.phone && json.nationalPhoneNumber) patch.phone = json.nationalPhoneNumber;
      const { error: upErr } = await supabaseAdmin.from("storefronts").update(patch).eq("id", row.id);
      if (upErr) {
        out.failed += 1;
        note(`saving website: ${upErr.message}`);
      } else {
        out.updated += 1;
      }
    } catch (err) {
      out.failed += 1;
      note(`places details threw: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  out.remaining = Math.max(out.remaining - out.updated, 0);
  return out;
}
