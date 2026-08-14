import { createFileRoute, Link } from "@tanstack/react-router";

import { StorefrontView } from "@/components/treatme/StorefrontView";
import { directoryQuery } from "@/lib/search-data";

/** canonical storefront page by id. /medspas/$slug redirects here. */
interface ClinicSeo {
  name: string;
  address_line: string;
  city: string;
  postcode: string;
  neighbourhood: string | null;
  phone: string | null;
  website: string | null;
  hero_image_url: string | null;
  lat: number;
  lng: number;
  rating: number;
  review_count: number;
  treatments: { name: string; price_from: number | null }[];
}

export const Route = createFileRoute("/storefront/$id")({
  head: ({
    params,
    loaderData,
  }: {
    params: { id: string };
    loaderData?: { clinic: ClinicSeo | null };
  }) => {
    const clinic = loaderData?.clinic;
    const where = clinic
      ? [clinic.neighbourhood, clinic.city].filter(Boolean).join(", ").toLowerCase()
      : "";
    const title = clinic ? `${clinic.name.toLowerCase()}${where ? ` · ${where}` : ""} · treatme` : "clinic · treatme";
    const description = clinic
      ? `who works at ${clinic.name.toLowerCase()}${where ? ` in ${where}` : ""}, the treatments they offer, hours, address and policies.`
      : "who works here, what they have on site, hours, address and policies for this clinic on treatme.";

    const jsonLd = clinic
      ? {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": `/storefront/${params.id}`,
          name: clinic.name,
          url: `/storefront/${params.id}`,
          ...(clinic.website ? { sameAs: clinic.website } : {}),
          ...(clinic.phone ? { telephone: clinic.phone } : {}),
          ...(clinic.hero_image_url ? { image: clinic.hero_image_url } : {}),
          address: {
            "@type": "PostalAddress",
            streetAddress: clinic.address_line,
            addressLocality: clinic.city,
            ...(clinic.postcode ? { postalCode: clinic.postcode } : {}),
            addressRegion: "ON",
            addressCountry: "CA",
          },
          geo: { "@type": "GeoCoordinates", latitude: clinic.lat, longitude: clinic.lng },
          ...(clinic.neighbourhood
            ? { areaServed: { "@type": "Place", name: clinic.neighbourhood } }
            : {}),
          ...(clinic.rating > 0 && clinic.review_count > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: clinic.rating,
                  reviewCount: clinic.review_count,
                },
              }
            : {}),
          ...(clinic.treatments.length
            ? {
                hasOfferCatalog: {
                  "@type": "OfferCatalog",
                  name: "treatments offered",
                  itemListElement: clinic.treatments.map((t) => ({
                    "@type": "Offer",
                    ...(t.price_from !== null
                      ? { price: t.price_from, priceCurrency: "CAD" }
                      : {}),
                    itemOffered: { "@type": "Service", name: t.name },
                  })),
                },
              }
            : {}),
        }
      : null;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `/storefront/${params.id}` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        ...(clinic?.hero_image_url
          ? [
              { property: "og:image", content: clinic.hero_image_url },
              { name: "twitter:image", content: clinic.hero_image_url },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `/storefront/${params.id}` }],
      ...(jsonLd
        ? { scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }] }
        : {}),
    };
  },
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(directoryQuery);
    const storefront = data.storefronts.find((s) => s.id === params.id || s.slug === params.id);
    if (!storefront) return { clinic: null };

    /** treatments offered here = everything the roster at this address does. */
    const byName = new Map<string, { name: string; price_from: number | null }>();
    for (const provider of data.providers) {
      if (!provider.storefronts.some((s) => s.id === storefront.id)) continue;
      for (const t of provider.treatments) {
        const price = typeof t.price_from === "number" ? t.price_from : null;
        const at = byName.get(t.name);
        if (!at) byName.set(t.name, { name: t.name, price_from: price });
        else if (price !== null && (at.price_from === null || price < at.price_from)) {
          at.price_from = price;
        }
      }
    }

    return {
      clinic: {
        name: storefront.name,
        address_line: storefront.address_line,
        city: storefront.city,
        postcode: storefront.postcode,
        neighbourhood: storefront.neighbourhood,
        phone: storefront.phone,
        website: storefront.website,
        hero_image_url: storefront.hero_image_url ?? storefront.cover_url,
        lat: storefront.lat,
        lng: storefront.lng,
        rating: storefront.rating,
        review_count: storefront.review_count,
        treatments: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
      },
    };
  },

  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <h1 className="text-[24px] font-medium lowercase">couldn't load this storefront.</h1>
      <p className="mt-2 text-[13px] text-ink-mute lowercase">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 pt-10">
      <h1 className="text-[24px] font-medium lowercase">storefront not found.</h1>
      <Link
        to="/search"
        search={{ q: undefined, scope: undefined }}
        className="mt-2 inline-block text-[13px] text-hot lowercase"
      >
        back to search
      </Link>
    </div>
  ),
  component: StorefrontByIdRoute,
});

function StorefrontByIdRoute() {
  const { id } = Route.useParams();
  return <StorefrontView match={(s) => s.id === id || s.slug === id} />;
}
