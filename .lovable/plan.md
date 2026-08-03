## goal

Clicking any med spa anywhere in the app opens a storefront page that feels like the clinic's own beautifully built website: big editorial hero, clear booking calls to action throughout, and their onboarding bundles presented as premium offers.

## 1. make every med spa tap land on the storefront

Audit and fix each med spa entry point so all of them resolve to `/storefront/$id`:
- search tab medspa rail cards and list rows
- map pin popover "view storefront" (currently `/medspas/$slug`, which redirects — keep working, but point cards directly at the canonical route)
- storefront chips on provider cards and provider profiles
Report any that were dead.

## 2. bundles in the database

New table `clinic_bundles` (one row per bundle a clinic sells), created via migration with grants, RLS and public read:
- storefront_id, name, tagline, included treatment slugs, sessions count, price, compare_at price (to show savings), validity months, sort order, active flag, badge (e.g. "most booked")
- public can read active bundles; only the clinic owner can create, edit or remove their own
Seed a few realistic bundles for the claimed demo clinics so the page looks real immediately.

## 3. rebuild the storefront page as a full editorial site

Same route, same data sources, new composition:

```text
full bleed hero image, clinic name over it, verified badge,
neighbourhood, treatme + google ratings, primary "book now"
--------------------------------------------------------
quick facts strip: hours today, phone, area, providers count
--------------------------------------------------------
BUNDLES  premium cards: name, what's included, sessions,
price with struck compare price and "save $X", book bundle
--------------------------------------------------------
who works here  provider cards with per provider book
--------------------------------------------------------
treatments offered  pills with from price, opens quick sheet,
each with book treatment
--------------------------------------------------------
the space  edge to edge gallery with lightbox
--------------------------------------------------------
what they have on site  devices, product lines, peel depths
--------------------------------------------------------
getting there  address, map link, transit, parking, access,
full hours with today highlighted
--------------------------------------------------------
good to know  policies
--------------------------------------------------------
unclaimed clinics: quiet claim card instead of bundles
--------------------------------------------------------
sticky bottom bar: "book at {clinic}"
```

Visual treatment stays on brand: cream, bubblegum, hot pink, butter, mint, ink, Helvetica Neue, all copy lowercase, no dashes anywhere, mobile first at 390px. Upgrades are typographic and spatial: larger hero type, generous section rhythm, hairline dividers, cards with soft radius, accent colour used sparingly on price and calls to action.

## 4. booking that carries what was tapped

Extend the consult route's search params to accept `bundleId` and `treatmentSlug` alongside `providerId` and `storefrontId`, and show which bundle or treatment is being booked on that screen. Every call to action passes the right ids:
- hero and sticky bar: storefront only
- bundle card: storefront plus bundle
- roster row: storefront plus provider
- treatment pill: storefront plus treatment slug

## technical notes

- `clinic_bundles` read through the existing `directoryQuery` pattern as its own query keyed by storefront id, so unclaimed clinics fetch nothing extra.
- Sections with no data stay hidden, so a bare unclaimed clinic still renders a clean short page.
- Reuse `ProviderCard` and the global treatment quick sheet; no duplicate components.
- Sanitize all bundle copy through the existing `noDash` helper.
