import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, MapPin, Star, BadgeCheck, Check, ShieldCheck } from "lucide-react";
import { ClientOnly } from "@tanstack/react-router";
import { directoryQuery, distanceKm, formatDistance, TORONTO_CENTROID } from "@/lib/search-data";
import {
  providerMediaQuery,
  providerReviewsQuery,
  elapsedLabel,
  reviewDate,
} from "@/lib/provider-profile";
import { providerFit, licenseLine } from "@/lib/provider-fit";
import { usePatient } from "@/lib/patient-store";
import { TreatmentSheet } from "@/components/treatme/TreatmentSheet";
import { SearchMap } from "@/components/treatme/SearchMap";
import { cn } from "@/lib/utils";


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
  component: ProviderProfile,
});

function ProviderProfile() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const { data } = useSuspenseQuery(directoryQuery);
  const provider = data.providers.find((p) => p.slug === slug);
  if (!provider) throw notFound();

  const { data: media } = useSuspenseQuery(providerMediaQuery(provider.id));
  const { data: reviews } = useSuspenseQuery(providerReviewsQuery(provider.id));

  const [bioOpen, setBioOpen] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [sheetSlug, setSheetSlug] = useState<string | null>(null);
  const { profile } = usePatient();

  const base = provider.storefronts[0] ?? null;
  const hasRating = provider.review_count >= 3;
  const initials = provider.name
    .split(" ")
    .filter((w) => !w.startsWith("dr"))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const langs = (provider.languages ?? []).length ? provider.languages.join(", ") : "english";
  const credentials = [
    provider.credentials || provider.title,
    `${provider.years_experience} years practising`,
    provider.licensing_body || "provincial regulatory college",
    `speaks ${langs}`,
  ].filter(Boolean);

  const license = licenseLine(provider);
  const fit = providerFit(provider, profile);
  const away = base ? formatDistance(distanceKm(TORONTO_CENTROID, { lat: base.lat, lng: base.lng })) : null;

  const shownReviews = allReviews ? reviews : reviews.slice(0, 3);


  return (
    <div className="pb-36">
      <div className="px-6 pt-2">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1 text-[12px] text-ink-mute lowercase -ml-1"
        >
          <ChevronLeft className="size-4" /> back
        </button>

        {/* header */}
        <div className="mt-4 flex gap-4 items-start">
          {provider.avatar_url ? (
            <img src={provider.avatar_url} alt={provider.name} className="size-24 rounded-full object-cover" />
          ) : (
            <span className="size-24 rounded-full bg-bubblegum/50 grid place-items-center font-bold text-[26px]">
              {initials}
            </span>
          )}
          <div className="min-w-0 pt-1">
            <h1 className="text-[24px] font-semibold leading-[1.05] lowercase">{provider.name}</h1>
            <p className="text-[13px] text-ink-mute lowercase mt-1">{provider.title}</p>
            {base && (
              <Link
                to="/storefront/$id"
                params={{ id: base.id }}
                className="mt-2 inline-flex items-center gap-1 rounded-pill bg-bubblegum/30 px-2.5 py-1 text-[11px] lowercase"
              >
                <MapPin className="size-3 text-hot" />
                {base.name}
                {provider.storefronts.length > 1 && ` +${provider.storefronts.length - 1} more`}
              </Link>
            )}
            <div className="mt-2 flex items-center gap-2 text-[12px] lowercase">
              {hasRating ? (
                <span className="inline-flex items-center gap-1 text-ink-soft">
                  <Star className="size-3.5 fill-ink text-ink" />
                  {provider.rating.toFixed(1)} ({provider.review_count})
                </span>
              ) : (
                <span className="rounded-pill bg-butter px-2 py-0.5 text-[11px] font-semibold">
                  new to treatme
                </span>
              )}
              {away && <span className="text-ink-mute">{away} away</span>}
            </div>
          </div>
        </div>

        {/* license verified against the public college registry. no unverified state. */}
        {license && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] lowercase text-ink-soft">
            <ShieldCheck className="size-4 text-hot shrink-0" />
            {license}
          </p>
        )}
      </div>

      {/* who this provider is right for */}
      {fit.length > 0 && (
        <section className="px-6 mt-7">
          <p className="brand-eyebrow">who this provider is right for</p>
          <ul className="mt-2 space-y-2">
            {fit.map((f) => (
              <li
                key={f.id}
                className={cn(
                  "rounded-2xl px-3 py-2 text-[13px] lowercase leading-snug",
                  f.tone === "match" && "bg-mint text-ink",
                  f.tone === "conflict" && "border border-line text-ink-soft",
                  f.tone === "neutral" && "bg-cream text-ink-soft",
                )}
              >
                {f.tone === "match" && (
                  <BadgeCheck className="mr-1.5 inline size-3.5 -mt-[2px] text-hot" />
                )}
                {f.label}
                {f.tone === "match" && (
                  <span className="ml-1 font-semibold">· matches your answers</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}


      {/* about */}
      <section className="px-6 mt-7">
        <p className="brand-eyebrow">about</p>
        <p
          className={cn(
            "mt-2 text-[14px] leading-relaxed text-ink-soft lowercase",
            !bioOpen && "line-clamp-3",
          )}
        >
          {provider.bio}
        </p>
        {provider.bio.length > 140 && (
          <button
            type="button"
            onClick={() => setBioOpen((v) => !v)}
            className="mt-1 text-[12px] text-hot lowercase"
          >
            {bioOpen ? "read less" : "read more"}
          </button>
        )}
      </section>

      {/* credentials */}
      <section className="px-6 mt-7">
        <p className="brand-eyebrow">credentials</p>
        <ul className="mt-2 space-y-2">
          {credentials.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[13px] text-ink-soft lowercase">
              <Check className="size-3.5 text-hot mt-[3px] shrink-0" />
              {c}
            </li>
          ))}
        </ul>
      </section>

      {/* treatments offered */}
      <section className="px-6 mt-7">
        <p className="brand-eyebrow">treatments offered</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {provider.treatments.map((t) => (
            <Link
              key={t.treatment_slug}
              to="/search"
              search={{ q: t.name }}
              className="rounded-pill border border-line px-3 py-1.5 text-[13px] lowercase"
            >
              {t.name}
            </Link>
          ))}
        </div>
      </section>

      {/* before and afters */}
      {media.length > 0 && (
        <section className="mt-7">
          <p className="brand-eyebrow px-6">before and afters</p>
          <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar px-6 pb-1">
            {media.map((m) => (
              <div key={m.id} className="w-[240px] shrink-0">
                <div className="grid grid-cols-2 gap-1 rounded-2xl overflow-hidden">
                  <img src={m.before_url} alt={`${m.treatment_name} before`} className="h-[150px] w-full object-cover" loading="lazy" />
                  <img src={m.after_url} alt={`${m.treatment_name} after`} className="h-[150px] w-full object-cover" loading="lazy" />
                </div>
                <p className="mt-1.5 text-[12px] text-ink-soft lowercase">
                  {m.treatment_name}
                  {m.weeks_between ? ` · ${elapsedLabel(m.weeks_between)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* storefront */}
      {base && (
        <section className="px-6 mt-7">
          <p className="brand-eyebrow">storefront</p>
          <div className="mt-2 rounded-2xl border border-line overflow-hidden">
            <ClientOnly fallback={<div className="h-[120px] bg-mint" />}>
              <SearchMap
                storefronts={[base]}
                center={{ lat: base.lat, lng: base.lng }}
                selectedId={null}
                onSelect={() => {}}
                height="120px"
              />
            </ClientOnly>
            <div className="p-4">
              <p className="brand-display text-[17px]">{base.name}</p>
              <p className="mt-1 text-[12px] text-ink-soft lowercase inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-hot" />
                {base.address_line}, {base.city} {base.postcode.toLowerCase()}
              </p>
              <Link
                to="/storefront/$id"
                params={{ id: base.id }}
                className="mt-2 block text-[13px] text-hot lowercase"
              >
                view storefront
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* reviews */}
      <section className="px-6 mt-7">
        <p className="brand-eyebrow">reviews</p>
        {reviews.length < 3 ? (
          <p className="mt-2 text-[13px] text-ink-mute lowercase">no reviews yet</p>
        ) : (
          <>
            <div className="mt-2 space-y-3">
              {shownReviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold lowercase">{r.reviewer_name}</p>
                    <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
                      <Star className="size-3.5 fill-ink text-ink" />
                      {r.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-mute lowercase">
                    {r.treatment_name} · {reviewDate(r.reviewed_at)}
                  </p>
                  <p className="mt-1.5 text-[13px] text-ink-soft lowercase leading-relaxed">{r.body}</p>
                </div>
              ))}
            </div>
            {reviews.length > 3 && (
              <button
                type="button"
                onClick={() => setAllReviews((v) => !v)}
                className="mt-2 text-[12px] text-hot lowercase"
              >
                {allReviews ? "show less" : `see all ${reviews.length} reviews`}
              </button>
            )}
          </>
        )}
      </section>

      <p className="px-6 mt-7 text-[11px] text-ink-mute lowercase leading-relaxed">
        provider details are supplied by the clinic. your provider confirms what is right for you at consult.
      </p>

      {/* sticky book bar */}
      <div className="fixed bottom-[76px] inset-x-0 px-6 z-20">
        <Link
          to="/book/consult"
          search={{ providerId: provider.id, storefrontId: base?.id }}
          className="flex items-center justify-center rounded-pill bg-hot text-cream py-3.5 text-[14px] font-semibold lowercase shadow-lg"
        >
          book a consult
        </Link>
      </div>
    </div>
  );
}
