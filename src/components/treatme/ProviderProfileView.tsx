import { Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  MapPin,
  Star,
  Check,
  ShieldCheck,
  Languages,
  Zap,
  Sparkles,
  Droplet,
} from "lucide-react";

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


import type { Provider } from "@/lib/search-data";

/** the provider profile page body. the provider is the hero, the storefront is context. */
export function ProviderProfileView({ match }: { match: (p: Provider) => boolean }) {
  const router = useRouter();
  const { data } = useSuspenseQuery(directoryQuery);
  const provider = data.providers.find(match);
  if (!provider) throw notFound();

  const { data: media } = useSuspenseQuery(providerMediaQuery(provider.id));
  const { data: reviews } = useSuspenseQuery(providerReviewsQuery(provider.id));

  const [bioOpen, setBioOpen] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [sheetSlug, setSheetSlug] = useState<string | null>(null);
  const { profile } = usePatient();

  // nearest storefront leads. the provider is the hero, the place is context.
  const stores = [...provider.storefronts].sort(
    (a, b) =>
      distanceKm(TORONTO_CENTROID, { lat: a.lat, lng: a.lng }) -
      distanceKm(TORONTO_CENTROID, { lat: b.lat, lng: b.lng }),
  );
  const base = stores[0] ?? null;
  const others = stores.slice(1);
  const hasRating = provider.review_count >= 3;
  const initials = provider.name
    .split(" ")
    .filter((w) => !w.startsWith("dr"))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const langs = (provider.languages ?? []).length ? provider.languages.join(", ") : "english";
  const certs = (provider.specialties ?? []).filter(Boolean);
  const credentials = [
    [provider.credentials || provider.title, provider.licensing_body].filter(Boolean).join(", "),
    `${provider.years_experience} years practising`,
    `speaks ${langs}`,
    certs.length ? `trained in ${certs.join(", ")}` : "",
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
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-[24px] font-medium leading-[1.05] lowercase">{provider.name}</h1>
            <p className="text-[13px] text-ink-mute lowercase mt-1">
              {provider.credentials || provider.title}
            </p>
            {base && (
              <Link
                to="/storefront/$id"
                params={{ id: base.id }}
                className="mt-2 inline-flex items-center gap-1 rounded-pill bg-bubblegum/30 px-2.5 py-1 text-[11px] lowercase"
              >
                <MapPin className="size-3 text-hot" />
                at {base.name}
                {others.length > 0 && ` and ${others.length} more`}
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
              {away && <span className="ml-auto text-ink-mute">{away} away</span>}
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
          <ul className="mt-2 rounded-2xl border border-line divide-y divide-line overflow-hidden">
            {fit.map((f) => {
              const Icon =
                f.icon === "language" ? Languages : f.icon === "device" ? Zap : f.icon === "treats" ? Sparkles : Droplet;
              return (
                <li
                  key={f.id}
                  className={cn(
                    "flex items-start gap-2 px-3 py-2.5 text-[13px] lowercase leading-snug",
                    f.tone === "match" && "bg-mint text-ink",
                    f.tone === "plain" && "bg-cream text-ink-soft",
                    f.tone === "neutral" && "text-ink-soft",
                  )}
                >
                  <Icon className="mt-[2px] size-3.5 shrink-0 text-hot" />
                  <span>{f.label}</span>
                </li>
              );
            })}
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

      {/* treatments offered. only treatments that exist in the treatments table. */}
      <section className="px-6 mt-7">
        <p className="brand-eyebrow">treatments offered</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {provider.treatments.map((t) => (
            <button
              key={t.treatment_slug}
              type="button"
              onClick={() => setSheetSlug(t.treatment_slug)}
              className="rounded-pill border border-line px-3 py-1.5 text-left text-[13px] lowercase"
            >
              {t.name}
              {t.price_from !== null && (
                <span className="ml-1.5 text-hot">from ${t.price_from}</span>
              )}
            </button>
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
          {provider.storefronts.length > 1 && (
            <div className="mt-2 space-y-1.5">
              {provider.storefronts.slice(1).map((s) => (
                <Link
                  key={s.id}
                  to="/storefront/$id"
                  params={{ id: s.id }}
                  className="flex items-center justify-between rounded-2xl border border-line px-3 py-2 text-[13px] lowercase"
                >
                  <span>{s.name}</span>
                  <span className="text-ink-mute">
                    {formatDistance(distanceKm(TORONTO_CENTROID, { lat: s.lat, lng: s.lng }))}
                  </span>
                </Link>
              ))}
            </div>
          )}
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

      {sheetSlug && <TreatmentSheet slug={sheetSlug} onClose={() => setSheetSlug(null)} />}
    </div>
  );

}
