import { useMemo, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Clock, MapPin, Phone, Sparkles, Star, Users, X } from "lucide-react";

import { ProviderCard } from "@/components/treatme/ProviderCard";
import {
  directoryQuery,
  neighbourhood,
  TORONTO_CENTROID,
  distanceKm,
  type Provider,
  type Storefront,
} from "@/lib/search-data";
import { clinicBundlesQuery, type ClinicBundle } from "@/lib/clinic-bundles";
import {
  googleRatingQuery,
  hoursRows,
  noDash,
  storefrontMediaQuery,
  todayKey,
} from "@/lib/storefront-detail";
import { useTreatmentSheet } from "@/lib/treatment-sheet-store";

const HOT = "#FF1F87";

/** the clinic's own website inside treatme: editorial hero, bundles, roster, booking everywhere. */
export function StorefrontView({ match }: { match: (s: Storefront) => boolean }) {
  const router = useRouter();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(directoryQuery);
  const storefront = data.storefronts.find(match) ?? null;

  const { openTreatment } = useTreatmentSheet();
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: photos = [] } = useQuery({
    ...storefrontMediaQuery(storefront?.id ?? ""),
    enabled: Boolean(storefront?.id),
  });
  const { data: google } = useQuery(googleRatingQuery(storefront?.google_place_id ?? null));
  const { data: bundles = [] } = useQuery({
    ...clinicBundlesQuery(storefront?.id ?? ""),
    enabled: Boolean(storefront?.id),
  });

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

  const nameForSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of treatments) map.set(t.slug, t.name);
    return map;
  }, [treatments]);

  if (!storefront) {
    return (
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
    );
  }

  const claimed = storefront.claimed;
  const area = storefront.neighbourhood ? noDash(storefront.neighbourhood) : neighbourhood(storefront);
  const reviewed = storefront.review_count >= 3;
  const rows = hoursRows(storefront.hours);
  const today = todayKey();
  const todayRow = rows.find((r) => r.key === today) ?? null;
  // some rows already carry the city and postcode inside address_line, so only add what is missing.
  const line = storefront.address_line.trim().replace(/,\s*$/, "");
  const lower = line.toLowerCase();
  const extras = [storefront.city, storefront.postcode]
    .filter((part) => part && !lower.includes(part.toLowerCase()))
    .join(" ");
  const fullAddress = extras ? `${line}, ${extras}` : line;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(`${storefront.name} ${fullAddress}`)}`;

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

  const facts: Array<{ icon: typeof Clock; label: string; value: string }> = [];
  if (todayRow) facts.push({ icon: Clock, label: "today", value: todayRow.value });
  if (claimed && roster.length > 0)
    facts.push({
      icon: Users,
      label: "providers",
      value: `${roster.length} on the floor`,
    });
  facts.push({ icon: MapPin, label: "area", value: area });

  return (
    <div className="pb-32">
      {/* hero */}
      <header className="relative">
        {storefront.cover_url ? (
          <img
            src={storefront.cover_url}
            alt={`inside ${noDash(storefront.name)}`}
            className="h-[380px] w-full object-cover"
          />
        ) : (
          <div className="h-[380px] w-full bg-mint" />
        )}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(17,17,17,0.35) 0%, rgba(17,17,17,0) 38%, rgba(17,17,17,0.82) 100%)",
          }}
        />
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="back"
          className="absolute left-4 grid size-9 place-items-center rounded-full bg-cream"
          style={{ top: "max(12px, env(safe-area-inset-top))" }}
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>

        <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
          <div className="flex flex-wrap items-center gap-1.5">
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
              <span className="inline-flex items-center gap-1 rounded-pill bg-cream/85 px-2.5 py-1 text-[12px] lowercase">
                <Star className="size-3 text-ink/60" />
                {google.rating.toFixed(1)}
                {google.count ? <span className="text-ink/60">({google.count})</span> : null}
                <span className="text-ink/60">on google</span>
              </span>
            )}
          </div>

          <div className="mt-3 flex items-start gap-1.5">
            <h1 className="text-[38px] font-medium leading-[1.02] tracking-[-0.03em] lowercase text-cream">
              {noDash(storefront.name)}
              <span style={{ color: HOT }}>.</span>
            </h1>
            {claimed && (
              <span className="mt-2 grid size-4 shrink-0 place-items-center rounded-full bg-cream">
                <Check className="size-2.5 text-ink" strokeWidth={3} />
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] lowercase text-cream/75">
            {storefront.tagline ? noDash(storefront.tagline) : area}
          </p>

          <Link
            to="/book/consult"
            search={{ storefrontId: storefront.id }}
            className="mt-4 block w-full rounded-pill bg-cream py-3.5 text-center text-[15px] font-semibold lowercase text-ink"
          >
            book at this clinic
          </Link>
        </div>
      </header>

      {/* quick facts */}
      <div className="flex gap-2.5 overflow-x-auto px-6 pt-5 no-scrollbar">
        {facts.map((f) => (
          <div
            key={f.label}
            className="min-w-[130px] shrink-0 rounded-[16px] border border-line bg-cream px-3.5 py-3"
          >
            <p className="inline-flex items-center gap-1 text-[11px] lowercase text-ink/55">
              <f.icon className="size-3" style={{ color: HOT }} />
              {f.label}
            </p>
            <p className="mt-1 text-[14px] font-medium lowercase leading-tight">{f.value}</p>
          </div>
        ))}
      </div>

      {/* bundles */}
      {claimed && bundles.length > 0 && (
        <section className="pt-9">
          <div className="px-6">
            <p className="text-[11px] font-semibold lowercase tracking-[0.08em] text-ink/50">
              packages
            </p>
            <h2 className="mt-1 text-[24px] font-medium lowercase leading-tight tracking-[-0.02em]">
              bundles at this clinic
            </h2>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto px-6 pb-1 no-scrollbar">
            {bundles.map((b) => (
              <BundleCard
                key={b.id}
                bundle={b}
                storefrontId={storefront.id}
                nameForSlug={nameForSlug}
              />
            ))}
          </div>
        </section>
      )}

      {/* the roster */}
      {claimed && roster.length > 0 && (
        <section className="px-6 pt-9">
          <h2 className="text-[24px] font-medium lowercase leading-tight tracking-[-0.02em]">
            who works here
          </h2>
          <div className="mt-4 space-y-2.5">
            {roster.map((p) => (
              <RosterRow key={p.id} provider={p} storefront={storefront} />
            ))}
          </div>
        </section>
      )}

      {/* treatments offered */}
      {claimed && treatments.length > 0 && (
        <section className="px-6 pt-9">
          <h2 className="text-[24px] font-medium lowercase leading-tight tracking-[-0.02em]">
            treatments offered
          </h2>
          <div className="mt-4 space-y-2">
            {treatments.map((t) => (
              <div
                key={t.slug}
                className="flex items-center gap-3 rounded-[16px] border border-line bg-cream px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => openTreatment(t.slug)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[15px] font-medium lowercase">
                    {noDash(t.name)}
                  </span>
                  {t.from !== null && (
                    <span className="mt-0.5 block text-[12px] lowercase" style={{ color: HOT }}>
                      from ${Math.round(t.from)}
                    </span>
                  )}
                </button>
                <Link
                  to="/book/consult"
                  search={{ storefrontId: storefront.id, treatmentSlug: t.slug }}
                  className="shrink-0 rounded-pill bg-ink px-3.5 py-1.5 text-[12px] font-semibold lowercase text-cream"
                >
                  book
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* the space */}
      {photos.length > 0 && (
        <section className="pt-9">
          <h2 className="px-6 text-[24px] font-medium lowercase leading-tight tracking-[-0.02em]">
            the space
          </h2>
          <div className="mt-4 flex gap-2.5 overflow-x-auto px-6 no-scrollbar">
            {photos.map((ph) => (
              <button key={ph.id} type="button" onClick={() => setLightbox(ph.url)} className="shrink-0">
                <img
                  src={ph.url}
                  alt={ph.caption ? noDash(ph.caption) : `inside ${noDash(storefront.name)}`}
                  loading="lazy"
                  className="h-[230px] w-[176px] rounded-[18px] object-cover"
                />
                {ph.caption && (
                  <span className="mt-1.5 block max-w-[176px] text-left text-[12px] lowercase text-ink/60">
                    {noDash(ph.caption)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* what they have on site */}
      {claimed && groups.length > 0 && (
        <section className="px-6 pt-9">
          <h2 className="text-[24px] font-medium lowercase leading-tight tracking-[-0.02em]">
            what they have on site
          </h2>
          {groups.map((g) => (
            <div key={g.label} className="mt-4">
              <p className="text-[12px] lowercase text-ink/55">{g.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-pill bg-mint px-2.5 py-1 text-[12px] lowercase"
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
      <section className="px-6 pt-9">
        <h2 className="text-[24px] font-medium lowercase leading-tight tracking-[-0.02em]">
          getting there
        </h2>
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-start gap-2 text-[14px] lowercase"
        >
          <MapPin className="mt-0.5 size-4 shrink-0" style={{ color: HOT }} />
          <span className="underline">{noDash(fullAddress)}</span>
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
              <span key={a} className="rounded-pill border border-line px-2.5 py-1 text-[12px] lowercase">
                {noDash(a)}
              </span>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <ul className="mt-4 overflow-hidden rounded-[18px] border border-line">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between px-4 py-2.5 text-[13px] lowercase"
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
            <Phone className="size-4" style={{ color: HOT }} />
            {noDash(storefront.phone)}
          </a>
        )}
      </section>

      {/* good to know */}
      {claimed && policies.length > 0 && (
        <section className="px-6 pt-9">
          <h2 className="text-[24px] font-medium lowercase leading-tight tracking-[-0.02em]">
            good to know
          </h2>
          <ul className="mt-4 space-y-2.5">
            {policies.map((p) => (
              <li key={p.label} className="text-[13.5px] lowercase leading-relaxed">
                <span className="text-ink/55">{p.label}: </span>
                {noDash(p.body ?? "")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* unclaimed: quiet claim card */}
      {!claimed && (
        <section className="px-6 pt-9">
          <div className="rounded-[20px] border border-line bg-cream p-5">
            <p className="text-[17px] font-medium lowercase">do you work here?</p>
            <p className="mt-1.5 text-[13px] lowercase leading-relaxed text-ink/70">
              claim this storefront to add your team, your bundles, your devices, and your booking
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/book/consult", search: { storefrontId: storefront.id } })}
              className="mt-3 text-[13px] lowercase underline"
            >
              claim this storefront
            </button>
          </div>
        </section>
      )}

      {/* sticky book bar */}
      <div
        className="fixed inset-x-0 bottom-[62px] z-40 border-t border-line bg-cream/95 px-6 py-3 backdrop-blur"
      >
        <Link
          to="/book/consult"
          search={{ storefrontId: storefront.id }}
          className="block w-full rounded-pill bg-ink py-3.5 text-center text-[15px] font-semibold lowercase text-cream"
        >
          book at {noDash(storefront.name)}
        </Link>
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-label="photo"
          className="fixed inset-0 z-[300] grid place-items-center bg-ink/95 px-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt={`inside ${noDash(storefront.name)}`} className="max-h-[86vh] w-full object-contain" />
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

/** a package the clinic sells, priced against what the treatments cost apart. */
function BundleCard({
  bundle,
  storefrontId,
  nameForSlug,
}: {
  bundle: ClinicBundle;
  storefrontId: string;
  nameForSlug: Map<string, string>;
}) {
  const included = bundle.treatmentSlugs.map((slug) =>
    noDash(nameForSlug.get(slug) ?? slug.replace(/-/g, " ")),
  );

  const meta = [
    bundle.sessions ? `${bundle.sessions} sessions` : null,
    bundle.validityMonths ? `valid ${bundle.validityMonths} months` : null,
  ].filter(Boolean) as string[];

  return (
    <article className="flex w-[280px] shrink-0 flex-col rounded-[20px] border border-line bg-cream p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-butter">
          <Sparkles className="size-4 text-ink" />
        </span>
        {bundle.badge && (
          <span
            className="rounded-pill px-2.5 py-1 text-[10px] font-semibold lowercase text-cream"
            style={{ backgroundColor: HOT }}
          >
            {bundle.badge}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-[19px] font-medium lowercase leading-tight tracking-[-0.02em]">
        {bundle.name}
      </h3>
      {bundle.tagline && (
        <p className="mt-1 text-[13px] lowercase leading-relaxed text-ink/65">{bundle.tagline}</p>
      )}

      {included.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {included.map((n) => (
            <span key={n} className="rounded-pill bg-mint px-2.5 py-1 text-[11px] lowercase">
              {n}
            </span>
          ))}
        </div>
      )}

      {meta.length > 0 && (
        <p className="mt-3 text-[12px] lowercase text-ink/55">{meta.join(" · ")}</p>
      )}

      <div className="mt-auto pt-4">
        {bundle.price !== null && (
          <p className="flex items-baseline gap-2">
            <span className="text-[24px] font-medium lowercase leading-none">
              ${Math.round(bundle.price)}
            </span>
            {bundle.compareAtPrice !== null && (
              <span className="text-[13px] lowercase text-ink/45 line-through">
                ${Math.round(bundle.compareAtPrice)}
              </span>
            )}
          </p>
        )}
        {bundle.saves !== null && (
          <p className="mt-1 text-[12px] font-semibold lowercase" style={{ color: HOT }}>
            you save ${bundle.saves}
          </p>
        )}
        <Link
          to="/book/consult"
          search={{ storefrontId, bundleId: bundle.id }}
          className="mt-3 block w-full rounded-pill bg-ink py-2.5 text-center text-[13px] font-semibold lowercase text-cream"
        >
          book this bundle
        </Link>
      </div>
    </article>
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
