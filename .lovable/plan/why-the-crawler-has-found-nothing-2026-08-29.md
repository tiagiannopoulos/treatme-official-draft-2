# why the crawler has found nothing

## what i checked

- `storefront_crawls` is completely empty: zero rows, no successes, no failures.
- `storefronts`: 3,054 rows, and `website` is null on **every single one**.
- the crawl runner only picks clinics where `website` is not null, so it has always had an empty work list. the crawler itself has never run once.

so the crawler isn't broken — step one (finding websites from google) never produced a single website.

## the actual fault

`backfillWebsites` calls google place details server-side with whichever maps key it finds first. i tested that call against the key this project exposes: google replies **403, "requests from referer <empty> are blocked"** — the maps key is browser-referrer restricted, and the backfill sends no `Referer` header. adding the project's preview referer to the same request returns 200 with a website.

the existing seed edge function already knew this and sets `Referer` manually. the newer backfill does not.

second problem that hid it: every failure in the loop is swallowed into a `failed` counter with no message, so a run of 100 clinics reports `{updated: 0, failed: 100}` and gives no reason. that is why this looked like "the crawler is broken" instead of "google is rejecting us".

## the fix

1. **send the referer.** in `place-details.server.ts`, send `Referer` (the project origin) on every place details request, and prefer an unrestricted server key (`GOOGLE_MAPS_API_KEY`) when one is present, falling back to the browser key plus referer.
2. **stop swallowing errors.** collect the first few real error messages (status + google's message) into the result the dev tool prints, so a failed run says why.
3. **surface the same for the crawler.** the dev page already prints json; include per-clinic error text.
4. **run it in order from `/dev/crawl`:** find websites (in batches of 100 until the pool of 3,054 is worked through), then run the crawl, then report status counts from `storefront_crawls` so we can see the real pass/fail mix (robots disallowed, fetch failed, no text, matched).

## technical notes

- files touched: `src/lib/place-details.server.ts` (referer + key preference + error reporting), `src/lib/crawl.functions.ts` and `src/routes/dev.crawl.tsx` only if needed to pass error detail through.
- no schema change. no change to matching, confidence threshold, robots handling, or the rule that a clinic's verified answer is never overwritten.
- `LOVABLE_API_KEY` is present, so ai matching should work once pages exist; if it doesn't, the crawl rows will now say so instead of failing quietly.
