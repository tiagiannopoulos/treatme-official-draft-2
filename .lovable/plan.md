# providers near you, under the map

Turn the section right under the map card on the search tab into a proper provider browsing row, and keep medspas as its own section below it.

## what changes

**providers near you (under the map card, explore state only)**

- Header "providers near you" in the same eyebrow style as every other section header on this page. Not "top providers", not "best providers".
- A horizontal scroll row of provider cards, reusing the existing search result provider card. No second card component is built.
- Each card is about 78 percent of the viewport width, so the next card peeks in from the right and it reads as scrollable.
- Five providers, ordered by distance from the patient (nearest first), using the location and radius already chosen above the row.
- If the patient has a skin type saved, providers whose fitzpatrick range covers it are ordered first and carry a small mint tag reading "matches your skin type".
- The last item in the row is a dashed outline card the same height as the others, with a chevron and "see all providers". Tapping it lands on the full provider list on this same tab: providers pill active, search field empty. No separate explore page.
- Tapping any provider card opens that provider profile, as it already does.
- If no providers fall inside the radius, the whole section is hidden. No placeholder.

**medspas near you**

Stays where it is, as its own horizontal rail below the providers section. Unchanged.

## rules kept

All copy lowercase. No dashes of any kind in visible copy. Mobile first at 390 px, no sideways page scroll, only the row itself scrolls.

## technical notes

- `src/routes/search.index.tsx`: replace the existing "providers near you" rail block (currently a plain rail of every in range provider) with the new row. The existing `providerResults` memo already gives distance sorted providers filtered to the radius, so ordering reuses it, then a stable sort puts fitzpatrick matches first before slicing to five.
- Skin type comes from `usePatient()` in `src/lib/patient-store.ts` (`profile.skinType`), matched against `fitzpatrick_min` / `fitzpatrick_max` on the provider, using the same numeric mapping as `src/lib/provider-fit.ts`.
- `src/components/treatme/ProviderCard.tsx`: `ProviderCardCompact` gains two optional props, a width class override (so the row can use `w-[78vw]`) and a `matchesSkinType` flag that renders the mint tag. Existing call sites keep their current 172 px width by default, so search results are untouched.
- The "see all providers" card is a small local component in `search.index.tsx` that sets scope to `providers` and clears the query, matching the existing pill behaviour.
