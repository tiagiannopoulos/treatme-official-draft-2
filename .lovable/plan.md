# fix scanning on the vercel deployment

## what's actually wrong

Scanning works in the Lovable preview and fails on treatmeapp.com. The evidence says the request never reaches the AI model at all:

- Last AI Gateway call was Aug 29 18:07 UTC. Your screenshot is Aug 30 ~05:11 UTC. No gateway request exists for the failed scan.
- `scan_errors` has exactly one row (a successful photo check), so nothing server-side logged the failure either.
- `/api/public/analyze` returns an instant `500 { code: "service" }` when `LOVABLE_API_KEY` is missing, and the scan screen renders that code as "our end had a problem. try again in a moment."

Lovable injects `LOVABLE_API_KEY` (and the Supabase server vars) into its own runtime. Vercel builds from your GitHub repo and knows nothing about them, so every AI-backed feature on treatmeapp.com fails immediately. Same for the chat routes and the crawler — they read the same key.

## the fix, two parts

### 1. Set the missing environment variables in Vercel

Add these in Vercel → Project → Settings → Environment Variables (Production + Preview), then redeploy:

- `LOVABLE_API_KEY` — powers the scan analysis, dermatologist chat, consult chat, and crawler
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID` — server-side auth, error logging, admin writes
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` — browser client (build-time)
- `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` — maps
- optional: `GOOGLE_MAPS_API_KEY` (server geocode/place details), `RESEND_API_KEY` and `TREATME_BOOKINGS_INBOX` (booking emails), `CRAWL_ADMIN_TOKEN` (crawler admin)

Also, the Google Maps browser key must allow `treatmeapp.com/*` as an HTTP referrer, otherwise the map on the live site throws `RefererNotAllowedMapError`.

I'll tell you which values to copy where; I can't write into your Vercel project myself.

### 2. Make this class of failure impossible to miss again

Code changes so the next environment problem names itself instead of showing a generic message:

- In `/api/public/analyze`, treat a missing `LOVABLE_API_KEY` as a distinct `config` failure: log it to `scan_errors` (via a plain fetch to Supabase REST so it works even without the admin client) and return `code: "config"`.
- On the analyzing screen, add a `config` failure message: "scanning isn't configured on this deployment yet." — no "try again" loop against something a retry can't fix, and lowercase brand voice preserved.
- Log the missing-key case with `console.error` so it lands in Vercel's function logs.
- Add a tiny `/api/public/health` route returning which server env vars are present as booleans only (never values), so we can confirm a Vercel deploy in one request instead of guessing from the UI.

## how we verify

1. You set the vars and redeploy.
2. I hit `https://treatmeapp.com/api/public/health` and confirm every flag is `true`.
3. You run one scan on the live site; I check AI Gateway logs for the new call and `scan_errors` for anything logged.

## technical notes

- No change to the scan pipeline, prompts, model (`google/gemini-3-flash-preview`), landmarks, measurements, or persistence.
- No secret values are committed; nothing is added to `.env`.
- The health route sits under `/api/public/*` so it bypasses site auth, and it reports presence only.
