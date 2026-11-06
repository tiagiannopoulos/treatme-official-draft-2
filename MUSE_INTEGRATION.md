# TreatMe Muse scan integration (feature branch)

This branch adds a parallel advanced three-photo scan flow at **/muse/scan**.
The original single-photo scan, map, provider storefronts and consultation request flow are unchanged.

## User journey
1. Open /muse/scan; consent and take front/left/right photos.
2. Continue to /muse/analyzing; use existing TreatMe sign-in session.
3. Submit for Gemini Vision via /api/muse-analyze.
4. See 16-point report at /muse/report/:scanId.
5. Select **find an aesthetic clinic near me** to open existing /search.

## Before testing
- Configure GEMINI_API_KEY on a preview deployment; without it the analysis endpoint intentionally returns 503.
- Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY for the server.
- Apply new `muse_scan_reports` migration to a separate staging Supabase instance before evaluating. It does not modify existing `scans`.
- Confirm 3-photo session data is not leaked and verify privacy/consent notices.
- Test signed-in and signed-out states, image validation, error conditions, report persistence, and /search CTA.
- The face overlay displays on newly generated reports in the current browser session; historical reports store structured scores only, not facial photographs.
- Confirm report text and storage have consent appropriate to the jurisdictions served.
- Do not advertise results as medically validated without independent testing.
- Ensure no changes deploy to main until smoke tests, medical-device/regulatory/privacy review, and explicit approval.

This is an integration candidate, not a clinically validated analysis engine. Model-derived skin scores and Fitzpatrick labels require validation and appropriate limitations.
