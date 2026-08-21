import {
  cleanMatches,
  combineText,
  matchTreatments,
  readSite,
  type CatalogEntry,
  type CrawlOutcome,
  type CrawlStatus,
} from "@/lib/crawl.server";

/** one clinic, end to end: read the site, match, write, log. */
export async function crawlOne(storefrontId: string): Promise<CrawlOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const log = async (o: CrawlOutcome) => {
    await supabaseAdmin.from("storefront_crawls").insert({
      storefront_id: storefrontId,
      url: o.url,
      status: o.status,
      pages_fetched: o.pages_fetched,
      treatments_found: o.treatments_found,
      error: o.error,
      ran_at: new Date().toISOString(),
    });
    return o;
  };
  const done = (status: CrawlStatus, url: string | null, pages = 0, found = 0, error: string | null = null) =>
    log({ status, url, pages_fetched: pages, treatments_found: found, error });

  const { data: storefront, error: sErr } = await supabaseAdmin
    .from("storefronts")
    .select("id, website")
    .eq("id", storefrontId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!storefront) throw new Error("storefront not found");
  if (!storefront.website) return done("no_website", null);

  const site = await readSite(storefront.website);
  if (site.status !== "ok") {
    return done(site.status, site.homepage, site.pages.length, 0, site.error);
  }

  const text = combineText(site.pages);
  if (text.length < 200) return done("no_text", site.homepage, site.pages.length, 0, "no readable text");

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return done("match_failed", site.homepage, site.pages.length, 0, "missing LOVABLE_API_KEY");

  const { data: treatments, error: tErr } = await supabaseAdmin
    .from("treatments")
    .select("slug, name, search_synonyms");
  if (tErr) throw new Error(tErr.message);
  const catalog: CatalogEntry[] = (treatments ?? []).map((t) => ({
    slug: t.slug,
    name: t.name,
    search_synonyms: (t.search_synonyms ?? []) as string[],
  }));

  const { matches, error: aiError } = await matchTreatments(text, catalog, apiKey);
  if (aiError) return done("match_failed", site.homepage, site.pages.length, 0, aiError);

  const kept = cleanMatches(matches, catalog, site.pages);
  if (kept.length === 0) return done("ok", site.homepage, site.pages.length, 0);

  // a clinic's own verified answer always beats our guess: never touch those rows.
  const { data: locked } = await supabaseAdmin
    .from("storefront_treatments")
    .select("treatment_slug")
    .eq("storefront_id", storefrontId)
    .eq("verified_by_clinic", true);
  const lockedSlugs = new Set((locked ?? []).map((r) => r.treatment_slug));

  const rows = kept
    .filter((m) => !lockedSlugs.has(m.treatment_slug))
    .map((m) => ({
      storefront_id: storefrontId,
      treatment_slug: m.treatment_slug,
      source: "website",
      confidence: m.confidence,
      evidence_url: m.evidence_url,
      evidence_snippet: m.evidence_snippet,
      price_from: m.price_from,
      verified_by_clinic: false,
      last_checked_at: new Date().toISOString(),
    }));

  if (rows.length > 0) {
    const { error: upErr } = await supabaseAdmin
      .from("storefront_treatments")
      .upsert(rows, { onConflict: "storefront_id,treatment_slug" });
    if (upErr) return done("match_failed", site.homepage, site.pages.length, 0, upErr.message);
  }

  return done("ok", site.homepage, site.pages.length, rows.length);
}

export interface RunnerResult {
  considered: number;
  crawled: number;
  results: Array<{ storefront_id: string; name: string; status: CrawlStatus; treatments_found: number }>;
}

/** every clinic with a website and no crawl in the last thirty days, two seconds apart. */
export async function crawlAll(limit = 50): Promise<RunnerResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: storefronts, error } = await supabaseAdmin
    .from("storefronts")
    .select("id, name, website")
    .not("website", "is", null)
    .order("name");
  if (error) throw new Error(error.message);

  const { data: recent } = await supabaseAdmin
    .from("storefront_crawls")
    .select("storefront_id, ran_at")
    .gte("ran_at", cutoff);
  const crawledRecently = new Set((recent ?? []).map((r) => r.storefront_id));

  const due = (storefronts ?? []).filter((s) => !crawledRecently.has(s.id)).slice(0, limit);
  const results: RunnerResult["results"] = [];

  for (const [i, s] of due.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const outcome = await crawlOne(s.id);
      results.push({
        storefront_id: s.id,
        name: s.name,
        status: outcome.status,
        treatments_found: outcome.treatments_found,
      });
    } catch (err) {
      results.push({
        storefront_id: s.id,
        name: s.name,
        status: "match_failed",
        treatments_found: 0,
      });
      console.error(`[treatme] crawl failed for ${s.name}:`, err);
    }
  }

  return { considered: due.length, crawled: results.length, results };
}
