import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";

import { directoryQuery } from "@/lib/search-data";

/** readable slug entry point. the canonical page lives at /storefront/$id. */
export const Route = createFileRoute("/medspas/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(directoryQuery);
    const storefront = data.storefronts.find((s) => s.slug === params.slug || s.id === params.slug);
    if (!storefront) throw notFound();
    throw redirect({ to: "/storefront/$id", params: { id: storefront.id } });
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <h1 className="text-[24px] font-medium lowercase">couldn't load this medspa.</h1>
      <p className="mt-2 text-[13px] text-ink-mute lowercase">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 pt-10">
      <h1 className="text-[24px] font-medium lowercase">medspa not found.</h1>
      <Link
        to="/search"
        search={{ q: undefined, scope: undefined }}
        className="mt-2 inline-block text-[13px] text-hot lowercase"
      >
        back to search
      </Link>
    </div>
  ),
  component: () => null,
});
