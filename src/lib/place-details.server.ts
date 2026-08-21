/**
 * websites come from google places details. we only keep the fields that make a
 * listing useful: the site we are allowed to read, the phone and the price band.
 */
export interface BackfillResult {
  considered: number;
  updated: number;
  no_website: number;
  failed: number;
}

function placesKey(): string | null {
  return (
    process.env["GOOGLE_MAPS_API_KEY"] ??
    process.env["VITE_GOOGLE_MAPS_API_KEY"] ??
    process.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] ??
    null
  );
}

export async function backfillWebsites(limit = 100): Promise<BackfillResult> {
  const key = placesKey();
  if (!key) throw new Error("no google places key on the server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("storefronts")
    .select("id, google_place_id, phone")
    .is("website", null)
    .not("google_place_id", "is", null)
    .limit(limit);
  if (error) throw new Error(error.message);

  const out: BackfillResult = { considered: (rows ?? []).length, updated: 0, no_website: 0, failed: 0 };

  for (const row of rows ?? []) {
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(row.google_place_id!)}`,
        {
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "websiteUri,nationalPhoneNumber",
          },
        },
      );
      if (!res.ok) {
        out.failed += 1;
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
      if (upErr) out.failed += 1;
      else out.updated += 1;
    } catch {
      out.failed += 1;
    }
  }

  return out;
}
