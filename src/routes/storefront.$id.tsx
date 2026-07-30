import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { directoryQuery } from "@/lib/search-data";

/** stable id entry point for storefronts. resolves to the readable /medspas/:slug page. */
export const Route = createFileRoute("/storefront/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(directoryQuery);
    const storefront = data.storefronts.find((s) => s.id === params.id || s.slug === params.id);
    if (!storefront) throw notFound();
    throw redirect({ to: "/medspas/$slug", params: { slug: storefront.slug } });
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <h1 className="brand-display text-[24px]">couldn't load this storefront.</h1>
      <p className="text-[13px] text-ink-mute mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 pt-10">
      <h1 className="brand-display text-[24px]">storefront not found.</h1>
      <Link to="/search" className="text-[13px] text-hot lowercase mt-2 inline-block">
        back to search
      </Link>
    </div>
  ),
  component: () => null,
});
