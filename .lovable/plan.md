# fix search map clustering and viewport loading

Make the search map respond to zoom and pan, load clinics from the visible map area, and keep map and list counts consistent.

## map behaviour

- Configure `MarkerClusterer` with `maxZoom: 13` so zoom levels above 13 render every clinic as an individual pin.
- Make cluster taps fit the map to that cluster’s bounds.
- Keep hot pink cluster bubbles with cream count labels.
- Stop radius framing from rerunning when pin data changes, which currently resets user zoom and makes clusters appear stuck.
- Detect the first user drag or zoom and switch the map from radius mode to viewport mode.
- Debounce idle viewport updates by 300 ms.
- Keep radius chips as framing controls: tapping a chip recentres and fits the corresponding distance, but does not permanently filter pins after interaction.
- Use greedy gestures on the embedded map and give it a mobile 4:3 aspect ratio. Keep full screen greedy and viewport filling.

## database backed viewport data

- Add a bounds query in the existing search data layer that reads storefront ids and coordinates inside the current north, south, east, and west bounds.
- Request at most 301 rows so the app can detect overflow while rendering no more than 300 pins.
- Reuse the existing directory storefront records for card content after the database returns the ids.
- Use the same database proximity query for the radius medspa list and the map’s initial pin set, so a smaller radius cannot report more medspas than a larger radius.
- Keep provider totals labelled as provider totals and medspa totals labelled as medspa totals so unlike counts are no longer presented as equivalent.

## pin and full screen details

- Position the selected storefront card relative to its actual Google Maps pin rather than at the top centre.
- Show storefront name, neighbourhood, patient distance when available, treatment count, and a `view` link.
- Dismiss the card on a map background tap.
- Pass the current bounds loaded storefronts into the full screen map and bottom sheet so both update together while panning.
- Show an overflow count when more than 300 clinics are inside the current viewport and prompt the user to zoom further.

## validation

- Verify the embedded map at a 390 px mobile viewport: 4:3 card, one finger pan, cluster tap zoom, and individual pins above zoom 13.
- Verify the full screen map bottom sheet updates after a pan.
- Compare 5 km, 10 km, 25 km, and 50 km medspa totals from the shared query and confirm they are monotonic.
