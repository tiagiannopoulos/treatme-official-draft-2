import { createFileRoute, Link } from "@tanstack/react-router";
import { directoryQuery } from "@/lib/search-data";
import { ProviderProfileView } from "@/components/treatme/ProviderProfileView";

export const Route = createFileRoute("/providers/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    return {
      meta: [
        { title: `${name} · treatme` },
        { name: "description", content: `book ${name} at their medspa. credentials, treatments and real before and afters.` },
        { property: "og:title", content: `${name} · treatme` },
        { property: "og:description", content: `book ${name} at their medspa. credentials, treatments and real before and afters.` },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
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
      <Link to="/search" search={{ q: undefined }} className="text-[13px] text-hot lowercase mt-2 inline-block">
        back to search
      </Link>
    </div>
  ),
  component: ProviderProfileRoute,
});


function ProviderProfileRoute() {
  const { slug } = Route.useParams();
  return <ProviderProfileView match={(p) => p.slug === slug} />;
}
