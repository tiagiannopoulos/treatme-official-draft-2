import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, Star, BadgeCheck, ArrowLeft } from "lucide-react";
import { directoryQuery, providerFromPrice } from "@/lib/search-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/providers/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    return {
      meta: [
        { title: `${name} · treatme` },
        { name: "description", content: `book ${name} at their medspa. credentials, treatments and locations.` },
        { property: "og:title", content: `${name} · treatme` },
        { property: "og:description", content: `book ${name} at their medspa. credentials, treatments and locations.` },
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
      <Link to="/search" className="text-[13px] text-hot lowercase mt-2 inline-block">
        back to search
      </Link>
    </div>
  ),
  component: ProviderProfile,
});

function ProviderProfile() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(directoryQuery);
  const provider = data.providers.find((p) => p.slug === slug);
  if (!provider) throw notFound();

  const price = providerFromPrice(provider);
  const initials = provider.name
    .split(" ")
    .filter((w) => !w.startsWith("dr"))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="pb-32">
      <div className="px-6">
        <Link to="/search" className="inline-flex items-center gap-1.5 text-[12px] text-ink-mute lowercase">
          <ArrowLeft className="size-3.5" /> search
        </Link>

        <div className="mt-4 flex gap-4 items-start">
          {provider.avatar_url ? (
            <img src={provider.avatar_url} alt={provider.name} className="size-20 rounded-full object-cover" />
          ) : (
            <span className="size-20 rounded-full bg-bubblegum/50 grid place-items-center font-bold text-[22px]">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="brand-display text-[26px] leading-[1] lowercase">{provider.name}</h1>
            <p className="text-[13px] text-ink-mute lowercase mt-1">
              {provider.title} · {provider.credentials}
            </p>
            <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-soft lowercase">
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 fill-ink text-ink" />
                {provider.rating} ({provider.review_count})
              </span>
              <span>{provider.years_experience} yrs experience</span>
              {provider.verified && (
                <span className="inline-flex items-center gap-1 text-hot">
                  <BadgeCheck className="size-3.5" /> verified
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-ink-soft lowercase">{provider.bio}</p>
      </div>

      <section className="px-6 mt-7">
        <p className="brand-eyebrow">works at</p>
        <div className="mt-2 space-y-2">
          {provider.storefronts.map((s) => (
            <div key={s.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="brand-display text-[17px]">{s.name}</p>
                {s.is_primary && (
                  <span className="rounded-pill bg-mint px-2 py-0.5 text-[10px] font-semibold lowercase">
                    main base
                  </span>
                )}
              </div>
              <p className="text-[12px] text-ink-mute lowercase mt-0.5">{s.tagline}</p>
              <p className="mt-1.5 text-[12px] text-ink-soft lowercase inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-hot" />
                {s.address_line}, {s.city} {s.postcode.toLowerCase()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 mt-7">
        <p className="brand-eyebrow">treatments they do</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {provider.treatments.map((t) => (
            <Link
              key={t.treatment_slug}
              to="/treatments/$slug"
              params={{ slug: t.treatment_slug }}
              className="rounded-xl border border-line p-3"
            >
              <p className="text-[13px] font-semibold lowercase leading-tight">{t.name}</p>
              <p className="text-[11px] text-ink-mute lowercase">{t.category}</p>
              {t.price_from !== null && (
                <p className="text-[12px] mt-1 lowercase">from ${t.price_from}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <p className="px-6 mt-7 text-[11px] text-ink-mute lowercase leading-relaxed">
        provider details are supplied by the clinic. your provider confirms what is right for you at consult.
      </p>

      <div className={cn("fixed bottom-[76px] inset-x-0 px-6 z-20")}>
        <Link
          to="/treatments/$slug/book"
          params={{ slug: provider.treatments[0]?.treatment_slug ?? "hydrafacial" }}
          search={{ area: undefined }}
          className="flex items-center justify-center rounded-pill bg-hot text-white py-3.5 text-[14px] font-semibold lowercase shadow-lg"
        >
          book with {provider.name.split(" ").slice(-1)[0]}
          {price !== null ? ` · from $${price}` : ""}
        </Link>
      </div>
    </div>
  );
}
