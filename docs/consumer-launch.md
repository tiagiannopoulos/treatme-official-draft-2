# TreatMe consumer launch

## Product scope

The first consumer journey is: guided photo, visible concern review, personal PDF,
AI conversation, and saved results/preferences. Reuse the existing TreatMe app.
The reference scan informs presentation; it is not evidence that a phone photo
can reproduce the measurements of a professional scanner.

The consumer should be able to understand their findings and priorities, learn
what treatments involve, and prepare questions for a provider. Personalisation
must consider budget, downtime, desired change, previous treatment experiences,
sensitivities and preferences such as avoiding needles.

A phased 1–3-year roadmap and calendar are a later slice. Suggested options,
provider-confirmed plans and booked appointments need distinct states. Booking
and provider marketplace expansion follow the core consumer experience.

## This draft

- Replaces the marketplace home with a clear scan/report/consult journey.
- Adds an authenticated, account-specific latest-scan shortcut with loading and
  error states. Opening home no longer depends on clinic/catalogue requests.
- Makes the consultant reachable in the bottom navigation and gives conversations
  without a scan a working home link.
- Uses one strict response validator for both structured AI output and the JSON
  fallback. Missing scores, findings, skin attributes or valid recommendations
  now cause a retryable failure. No default findings or procedures are filled in.
- Adds response-validation regression tests; these do not measure clinical accuracy.

This is a web-app draft, not an iOS build or an App Store submission.

## Next implementation priorities

| Priority | Finding in current source                                                                                                                           | Completion target                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | `scan-concerns.ts` derives some concerns and regional scores from other values; `skinAnalysis/fromAnalysis.ts` assigns all concerns confidence 0.9. | Mark estimates and unassessable observations explicitly. Remove unsupported confidence/precision; agree which visible concerns are actually supported.                              |
| 2        | Results use pixel-derived `measured` values, but `report-data.ts` and the consultant summary call `toConcernRows` without them.                     | One persisted, versioned result set feeds the screen, PDF and chat; opening a saved scan preserves that result set.                                                                 |
| 3        | `report-data.ts` uses index-based treatment ordering text, including a generic two-week interval.                                                   | PDF presents educational options and provider questions. Procedure sequencing and intervals require reviewed, treatment-specific rules and provider confirmation.                   |
| 4        | The consultant endpoint uses the ten-item static `TREATMENTS` array, while the treatment library/PDF query the database catalogue.                  | Use the complete reviewed catalogue; enforce budget, downtime and hard preferences such as no needles before presenting options.                                                    |
| 5        | Source review does not demonstrate agreement with professionals or repeat-scan stability.                                                           | Evaluate consented reference photos across skin tones, devices and lighting; compare repeated captures and independent professional assessments, with agreed acceptance thresholds. |
| 6        | No native iOS project was found in this repository.                                                                                                 | Choose the mobile packaging approach after the core journey works, then test capture, login, saved reports, sharing and deletion on devices before submission.                      |

## Verification

Completed on this draft: eight regression tests, the TypeScript check,
production build, focused lint for the new validator/home screen, and an HTTP
render check for the home heading and scan/consult/profile/treatment links.
The preview browser could not connect, so visual mobile review and signed-in
end-to-end checks remain outstanding.

Run `npm run test:scan-response` with Node 22.18+ or Node 24, then `npm run build`.
The tests use synthetic objects and make no AI or patient-data requests.

Check the home at a narrow mobile width and desktop width; verify scan, consult,
profile and treatment links. For a test account, verify no scans, a saved scan,
loading, failed requests and sign-out/account switching. Check that an incomplete
AI response never reaches scan persistence, while a valid response still does.

Live AI reliability, signed-in end-to-end scans, PDF/result parity, hard preference
filtering and device behaviour remain separate launch gates.
