import { createFileRoute, Link } from "@tanstack/react-router";

import { StorefrontView } from "@/components/treatme/StorefrontView";
import { directoryQuery } from "@/lib/search-data";

/** canonical storefront page by id. /medspas/$slug redirects here. */
export const Route = createFileRoute("/storefront/$id")({
  head: () => ({
    meta: [
      { title: "clinic · treatme" },
      {
        name: "description",
        content:
          "who works here, what they have on site, hours, address and policies for this clinic on treatme.",
      },
      { property: "og:title", content: "clinic · treatme" },
      {
        property: "og:description",
        content:
          "who works here, what they have on site, hours, address and policies for this clinic on treatme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery);
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
