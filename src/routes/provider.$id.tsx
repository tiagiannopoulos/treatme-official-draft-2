import { createFileRoute, Link } from "@tanstack/react-router";

import { directoryQuery } from "@/lib/search-data";
import { ProviderProfileView } from "@/components/treatme/ProviderProfileView";

/** canonical provider profile by id. /providers/$slug renders the same view. */
export const Route = createFileRoute("/provider/$id")({
  head: () => ({
    meta: [
      { title: "provider · treatme" },
      {
        name: "description",
        content:
          "credentials, verified licence, treatments and real before and afters for this provider on treatme.",
      },
      { property: "og:title", content: "provider · treatme" },
      {
        property: "og:description",
        content:
          "credentials, verified licence, treatments and real before and afters for this provider on treatme.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery);
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <h1 className="brand-display text-[26px]">couldn't load this provider.</h1>
      <p className="text-[13px] text-ink-mute mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 pt-10">
      <h1 className="brand-display text-[26px]">provider not found.</h1>
      <Link
        to="/search"
        search={{ q: undefined, scope: undefined }}
        className="text-[13px] text-hot lowercase mt-2 inline-block"
      >
        back to search
      </Link>
    </div>
  ),
  component: ProviderByIdRoute,
});

function ProviderByIdRoute() {
  const { id } = Route.useParams();
  return <ProviderProfileView match={(p) => p.id === id || p.slug === id} />;
}
