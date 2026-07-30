import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { directoryQuery } from "@/lib/search-data";

export const Route = createFileRoute("/medspas/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    return {
      meta: [
        { title: `${name} · treatme` },
        { name: "description", content: `see the providers working at ${name} and book a consult.` },
        { property: "og:title", content: `${name} · treatme` },
        { property: "og:description", content: `see the providers working at ${name} and book a consult.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery);
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <h1 className="brand-display text-[24px]">couldn't load this medspa.</h1>
      <p className="text-[13px] text-ink-mute mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 pt-10">
      <h1 className="brand-display text-[24px]">medspa not found.</h1>
      <Link to="/search" search={{}} className="text-[13px] text-hot lowercase mt-2 inline-block">
        back to search
      </Link>
    </div>
  ),
  component: MedspaPage,
});

function MedspaPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(directoryQuery);
  const storefront = data.storefronts.find((s) => s.slug === slug);
  if (!storefront) throw notFound();

  const providers = data.providers.filter((p) => p.storefronts.some((x) => x.id === storefront.id));

  return (
    <div className="px-6 pb-28">
      <Link to="/search" search={{}} className="inline-flex items-center gap-1.5 text-[12px] text-ink-mute lowercase">
        <ArrowLeft className="size-3.5" /> search
      </Link>

      <h1 className="brand-display text-[28px] leading-[1] mt-3 lowercase">{storefront.name}</h1>
      <p className="text-[13px] text-ink-mute lowercase mt-1">{storefront.tagline}</p>
      <p className="mt-2 text-[12.5px] text-ink-soft lowercase inline-flex items-center gap-1">
        <MapPin className="size-3.5 text-hot" />
        {storefront.address_line}, {storefront.city} {storefront.postcode.toLowerCase()}
      </p>
      <p className="mt-1 text-[12.5px] text-ink-soft inline-flex items-center gap-1">
        {storefront.review_count ? (
          <>
            <Star className="size-3.5 fill-ink text-ink" />
            {storefront.rating} ({storefront.review_count})
          </>
        ) : (
          <span className="rounded-pill bg-butter px-2 py-0.5 text-[11px] font-semibold lowercase">
            new to treatme
          </span>
        )}
      </p>

      <section className="mt-7">
        <p className="brand-eyebrow">providers here</p>
        <div className="mt-2 space-y-2">
          {providers.map((p) => (
            <Link
              key={p.id}
              to="/providers/$slug"
              params={{ slug: p.slug }}
              className="flex items-center gap-3 rounded-2xl border border-line p-3"
            >
              <span className="size-11 rounded-full bg-bubblegum/50 grid place-items-center font-bold text-[13px]">
                {p.name
                  .split(" ")
                  .filter((w) => !w.startsWith("dr"))
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold lowercase truncate">{p.name}</span>
                <span className="block text-[11.5px] text-ink-mute lowercase truncate">{p.title}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
