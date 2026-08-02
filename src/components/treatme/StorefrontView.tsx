import { useMemo, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, MapPin, Phone, Star, X } from "lucide-react";

import { ProviderCard } from "@/components/treatme/ProviderCard";
import {
  directoryQuery,
  neighbourhood,
  TORONTO_CENTROID,
  distanceKm,
  type Provider,
  type Storefront,
} from "@/lib/search-data";
import {
  googleRatingQuery,
  hoursRows,
  noDash,
  storefrontMediaQuery,
  todayKey,
} from "@/lib/storefront-detail";

/** full storefront page. the roster sits directly under the hero on purpose. */
export function StorefrontView({ match }: { match: (s: Storefront) => boolean }) {
  const router = useRouter();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(directoryQuery);
  const storefront = data.storefronts.find(match) ?? null;

  const [filterSlug, setFilterSlug] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: photos = [] } = useQuery({
    ...storefrontMediaQuery(storefront?.id ?? ""),
    enabled: Boolean(storefront?.id),
  });
  const { data: google } = useQuery(googleRatingQuery(storefront?.google_place_id ?? null));

  const roster = useMemo(
    () =>
      storefront
        ? data.providers.filter((p) => p.storefronts.some((s) => s.id === storefront.id))
        : [],
    [data.providers, storefront],
  );

  const treatments = useMemo(() => {
    const byName = new Map<string, { slug: string; name: string; from: number | null }>();
    for (const p of roster) {
      for (const t of p.treatments) {
        const at = byName.get(t.treatment_slug);
        const price = typeof t.price_from === "number" ? t.price_from : null;
        if (!at) byName.set(t.treatment_slug, { slug: t.treatment_slug, name: t.name, from: price });
        else if (price !== null && (at.from === null || price < at.from)) at.from = price;
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [roster]);

  if (!storefront) {
    return (
      <div className="px-6 pt-10">
        <h1 className="text-[24px] font-medium lowercase">storefront not found.</h1>
        <Link
          to="/search"
          search={{ q: undefined }}
          className="mt-2 inline-block text-[13px] text-hot lowercase"
        >
          back to search
        </Link>
      </div>
    );
  }

  const claimed = storefront.claimed;
  const area = storefront.neighbourhood ? noDash(storefront.neighbourhood) : neighbourhood(storefront);
  const reviewed = storefront.review_count >= 3;
  const rows = hoursRows(storefront.hours);
  const today = todayKey();
  const fullAddress = `${storefront.address_line}, ${storefront.city} ${storefront.postcode}`;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(`${storefront.name} ${fullAddress}`)}`;

  const shownRoster = filterSlug
    ? roster.filter((p) => p.treatments.some((t) => t.treatment_slug === filterSlug))
    : roster;

  const groups: Array<{ label: string; items: string[] }> = [
    { label: "devices", items: storefront.devices ?? [] },
    { label: "product lines", items: storefront.product_lines ?? [] },
    { label: "peel depths", items: storefront.peel_depths ?? [] },
  ].filter((g) => g.items.length > 0);

  const policies = [
    { label: "cancellation", body: storefront.cancellation_policy },
    { label: "deposit", body: storefront.deposit_policy },
    { label: "late arrival", body: storefront.late_policy },
  ].filter((p) => Boolean(p.body));

  return (
    <div className="pb-28">
      {/* hero */}
      <div className="relative">
        {storefront.cover_url ? (
          <img
            src={storefront.cover_url}
            alt={`inside ${storefront.name}`}
            className="h-[220px] w-full object-cover"
          />
        ) : (
          <div className="grid h-[220px] w-full place-items-center bg-mint">
            <span className="text-[48px] font-medium lowercase text-ink">
              {storefront.name.trim()[0]?.toLowerCase()}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="back"
          className="absolute left-4 grid size-9 place-items-center rounded-full bg-cream"
          style={{ top: "max(12px, env(safe-area-inset-top))" }}
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
      </div>

      <div className="px-6 pt-4">
        <div className="flex items-center gap-1.5">
          <h1 className="text-[24px] font-medium leading-tight lowercase">{noDash(storefront.name)}</h1>
          {claimed && (
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-ink">
              <Check className="size-2.5 text-cream" strokeWidth={3} />
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] lowercase text-ink/60">{area}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {reviewed ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-cream px-2.5 py-1 text-[12px] lowercase">
              <Star className="size-3 fill-ink text-ink" />
              {storefront.rating.toFixed(1)}
              <span className="text-ink/60">({storefront.review_count}) on treatme</span>
            </span>
          ) : (
            <span className="rounded-pill bg-butter px-2.5 py-1 text-[11px] font-semibold lowercase">
              new to treatme
            </span>
          )}
          {google?.rating !== null && google?.rating !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-pill border border-line px-2.5 py-1 text-[12px] lowercase">
              <Star className="size-3 text-ink/60" />
              {google.rating.toFixed(1)}
              {google.count ? <span className="text-ink/60">({google.count})</span> : null}
              <span className="text-ink/60">on google</span>
            </span>
          )}
        </div>
      </div>

      {/* the roster, directly under the hero */}
      {claimed && roster.length > 0 && (
        <section className="px-6 pt-6">
          <h2 className="text-[17px] font-medium lowercase">who works here</h2>
          {filterSlug && (
            <button
              type="button"
              onClick={() => setFilterSlug(null)}
              className="mt-2 inline-flex items-center gap-1 rounded-pill bg-bubblegum/30 px-2.5 py-1 text-[12px] lowercase"
            >
              showing {noDash(treatments.find((t) => t.slug === filterSlug)?.name ?? "")}
              <X className="size-3" />
            </button>
          )}
          <div className="mt-3 space-y-2.5">
            {shownRoster.map((p) => (
              <RosterRow key={p.id} provider={p} storefront={storefront} />
            ))}
            {shownRoster.length === 0 && (
              <p className="text-[13px] lowercase text-ink/60">
                nobody here lists that treatment yet.
              </p>
            )}
          </div>
        </section>
      )}

      {/* what they have on site */}
      {claimed && groups.length > 0 && (
        <section className="px-6 pt-8">
          <h2 className="text-[17px] font-medium lowercase">what they have on site</h2>
          {groups.map((g) => (
            <div key={g.label} className="mt-3">
              <p className="text-[12px] lowercase text-ink/60">{g.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-pill border border-line px-2.5 py-1 text-[12px] lowercase"
                  >
                    {noDash(item)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* getting there */}
      <section className="px-6 pt-8">
        <h2 className="text-[17px] font-medium lowercase">getting there</h2>
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-start gap-2 text-[14px] lowercase"
        >
          <MapPin className="mt-0.5 size-4 shrink-0 text-hot" />
          <span>{noDash(fullAddress)}</span>
        </a>

        {storefront.transit_note && (
          <p className="mt-2 text-[13px] lowercase text-ink/70">{noDash(storefront.transit_note)}</p>
        )}
        {storefront.parking && (
          <p className="mt-1 text-[13px] lowercase text-ink/70">parking: {noDash(storefront.parking)}</p>
        )}

        {(storefront.accessibility ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {storefront.accessibility.map((a) => (
              <span key={a} className="rounded-pill bg-mint px-2.5 py-1 text-[12px] lowercase">
                {noDash(a)}
              </span>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <ul className="mt-4 overflow-hidden rounded-2xl border border-line">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between px-3.5 py-2.5 text-[13px] lowercase"
                style={{
                  backgroundColor: r.key === today ? "#FFEDB4" : "transparent",
                  borderTop: "1px solid rgba(17,17,17,0.06)",
                }}
              >
                <span className={r.key === today ? "font-semibold" : "text-ink/70"}>{r.label}</span>
                <span>{r.value}</span>
              </li>
            ))}
          </ul>
        )}

        {storefront.phone && (
          <a
            href={`tel:${storefront.phone.replace(/[^\d+]/g, "")}`}
            className="mt-3 inline-flex items-center gap-2 text-[14px] lowercase"
          >
            <Phone className="size-4 text-hot" />
            {noDash(storefront.phone)}
          </a>
        )}
      </section>

      {/* the space */}
      {photos.length > 0 && (
        <section className="pt-8">
          <h2 className="px-6 text-[17px] font-medium lowercase">the space</h2>
          <div className="mt-3 flex gap-2.5 overflow-x-auto px-6 no-scrollbar">
            {photos.map((ph) => (
              <button
                key={ph.id}
                type="button"
                onClick={() => setLightbox(ph.url)}
                className="shrink-0"
              >
                <img
                  src={ph.url}
                  alt={ph.caption ? noDash(ph.caption) : `inside ${storefront.name}`}
                  loading="lazy"
                  className="h-[150px] w-[220px] rounded-2xl object-cover"
                />
                {ph.caption && (
                  <span className="mt-1 block text-left text-[12px] lowercase text-ink/60">
                    {noDash(ph.caption)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* treatments offered */}
      {claimed && treatments.length > 0 && (
        <section className="px-6 pt-8">
          <h2 className="text-[17px] font-medium lowercase">treatments offered</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {treatments.map((t) => {
              const on = filterSlug === t.slug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setFilterSlug(on ? null : t.slug)}
                  className="rounded-pill border px-2.5 py-1.5 text-[12px] lowercase"
                  style={{
                    borderColor: on ? "#111111" : "rgba(17,17,17,0.12)",
                    backgroundColor: on ? "#F8A1C6" : "transparent",
                  }}
                >
                  {noDash(t.name)}
                  {t.from !== null && (
                    <span className="ml-1" style={{ color: on ? "#111111" : "#FF1F87" }}>
                      from ${Math.round(t.from)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* good to know */}
      {claimed && policies.length > 0 && (
        <section className="px-6 pt-8">
          <h2 className="text-[17px] font-medium lowercase">good to know</h2>
          <ul className="mt-3 space-y-2.5">
            {policies.map((p) => (
              <li key={p.label} className="text-[13.5px] lowercase leading-relaxed">
                <span className="text-ink/60">{p.label}: </span>
                {noDash(p.body ?? "")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* unclaimed: quiet claim card */}
      {!claimed && (
        <section className="px-6 pt-8">
          <div className="rounded-2xl border border-line bg-cream p-5">
            <p className="text-[16px] font-medium lowercase">do you work here?</p>
            <p className="mt-1.5 text-[13px] lowercase leading-relaxed text-ink/70">
              claim this storefront to add your team, your devices, and your booking
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/book/consult" })}
              className="mt-3 text-[13px] lowercase underline"
            >
              claim this storefront
            </button>
          </div>
        </section>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-label="photo"
          className="fixed inset-0 z-[300] grid place-items-center bg-ink/95 px-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt={`inside ${storefront.name}`} className="max-h-[86vh] w-full object-contain" />
          <button
            type="button"
            aria-label="close"
            onClick={() => setLightbox(null)}
            className="absolute right-4 grid size-10 place-items-center rounded-full bg-cream"
            style={{ top: "max(16px, env(safe-area-inset-top))" }}
          >
            <X className="size-5 text-ink" />
          </button>
        </div>
      )}
    </div>
  );
}

/** the search tab card, plus a book button for this location. */
function RosterRow({ provider, storefront }: { provider: Provider; storefront: Storefront }) {
  const shops = provider.storefronts.filter((s) => s.id === storefront.id);
  const km = distanceKm(TORONTO_CENTROID, { lat: storefront.lat, lng: storefront.lng });
  return (
    <div className="relative">
      <ProviderCard provider={provider} km={km} shops={shops} />
      <Link
        to="/book/consult"
        search={{ providerId: provider.id, storefrontId: storefront.id }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3.5 right-3.5 rounded-pill bg-ink px-3.5 py-1.5 text-[12px] font-semibold lowercase text-cream"
      >
        book
      </Link>
    </div>
  );
}
