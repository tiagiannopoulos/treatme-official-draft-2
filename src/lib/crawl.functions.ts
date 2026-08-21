import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** discovery for one clinic. signed in only, and gated by a token when one is set. */
export const crawlStorefront = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { storefrontId: string; token?: string }) => {
    if (!input?.storefrontId || typeof input.storefrontId !== "string") throw new Error("storefrontId required");
    return input;
  })
  .handler(async ({ data }) => {
    const gate = process.env["CRAWL_ADMIN_TOKEN"];
    if (gate && data.token !== gate) throw new Error("not allowed");
    const { crawlOne } = await import("@/lib/crawl-run.server");
    return crawlOne(data.storefrontId);
  });

/** the runner: every clinic with a website and no crawl in thirty days. */
export const crawlAllStorefronts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { limit?: number; token?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const gate = process.env["CRAWL_ADMIN_TOKEN"];
    if (gate && data.token !== gate) throw new Error("not allowed");
    const { crawlAll } = await import("@/lib/crawl-run.server");
    return crawlAll(Math.min(Math.max(data.limit ?? 25, 1), 200));
  });

/** websites first: google places details fills the website column we crawl from. */
export const backfillStorefrontWebsites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { limit?: number; token?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const gate = process.env["CRAWL_ADMIN_TOKEN"];
    if (gate && data.token !== gate) throw new Error("not allowed");
    const { backfillWebsites } = await import("@/lib/place-details.server");
    return backfillWebsites(Math.min(Math.max(data.limit ?? 100, 1), 500));
  });
