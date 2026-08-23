import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Accessibility,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  Info,
  MapPin,
  Star,
  Users,
  X,
} from "lucide-react";

import { ProviderCard } from "@/components/treatme/ProviderCard";
import { StorefrontMapStrip } from "@/components/treatme/StorefrontMapStrip";
import {
  directoryQuery,
  formatDistance,
  neighbourhood,
  type LatLng,
  type Provider,
  type Storefront,
} from "@/lib/search-data";
import { googleRatingQuery, noDash, storefrontMediaQuery } from "@/lib/storefront-detail";
import { storefrontTreatmentsQuery, type ListedTreatment } from "@/lib/storefront-treatments";
import { StorefrontOffers, type OfferRow } from "@/components/treatme/StorefrontOffers";
import {
  accentOf,
  accentTint,
  categoryTags,
  fitzNumber,
  openStatus,
  providersForSkinType,
  textOnAccent,
  todayIndex,
  weekHours,
} from "@/lib/storefront-brand";
import { usePatient } from "@/lib/patient-store";
import { useNearbyKm } from "@/lib/nearby";
import { useTreatmentSheet } from "@/lib/treatment-sheet-store";

/** the clinic's own branded store inside treatme. accent and logo carry the identity. */
export function StorefrontView({ match }: { match: (s: Storefront) => boolean }) {
  const router = useRouter();
  const { data } = useSuspenseQuery(directoryQuery);
  const storefront = data.storefronts.find(match) ?? null;

  const { openTreatment } = useTreatmentSheet();
  const patient = usePatient();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [filterSlug, setFilterSlug] = useState<string | null>(null);
  const near = useNearbyKm();
  const rosterRef = useRef<HTMLDivElement>(null);

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

  // what the clinic's own website lists, plus anything they verified themselves.
  const { data: listed = [] as ListedTreatment[] } = useQuery({
    ...storefrontTreatmentsQuery(storefront?.id ?? ""),
    enabled: Boolean(storefront?.id),
  });

  const treatments = useMemo(() => {
    const bySlug = new Map<string, OfferRow>();

    // their website is the weaker source, so it goes in first and gets overwritten.
    for (const t of listed) {
      bySlug.set(t.slug, {
        slug: t.slug,
        name: t.name,
        family: t.family,
        from: t.from,
        listedOnSiteUrl: t.verified ? null : t.evidenceUrl,
      });
    }

    for (const p of roster) {
      for (const t of p.treatments) {
        const price = typeof t.price_from === "number" ? t.price_from : null;
        const at = bySlug.get(t.treatment_slug);
        if (!at) {
          bySlug.set(t.treatment_slug, {
            slug: t.treatment_slug,
            name: t.name,
            family: t.category || "treatments",
            from: price,
            listedOnSiteUrl: null,
          });
        } else {
          at.listedOnSiteUrl = null;
          at.name = t.name;
          at.family = t.category || at.family;
          if (price !== null && (at.from === null || price < at.from)) at.from = price;
        }
      }
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [roster, listed]);


  const families = useMemo(() => {
    const groups = new Map<string, typeof treatments>();
    for (const t of treatments) {
      const list = groups.get(t.family) ?? [];
      list.push(t);
      groups.set(t.family, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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

  const accent = accentOf(storefront);
  const onAccent = textOnAccent(accent);
  const claimed = storefront.claimed;
  const area = storefront.neighbourhood ? noDash(storefront.neighbourhood) : neighbourhood(storefront);
  const name = noDash(storefront.name);

  const line = storefront.address_line.trim().replace(/,\s*$/, "");
  const lower = line.toLowerCase();
  const extras = [storefront.city, storefront.postcode]
    .filter((part) => part && !lower.includes(part.toLowerCase()))
    .join(" ");
  const fullAddress = noDash(extras ? `${line}, ${extras}` : line);
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(`${storefront.name} ${fullAddress}`)}`;
  const km = near.kmFor(storefront.id);

  const week = weekHours(storefront.hours);
  const status = openStatus(week);
  const today = todayIndex();

  const tags = categoryTags(
    claimed ? families.map(([family]) => family) : [],
    storefront.price_band,
  );

  const skinMatches = providersForSkinType(roster, patient.profile);
  const skinFitz = fitzNumber(patient.profile.skinType);

  const shownRoster = filterSlug
    ? roster.filter((p) => p.treatments.some((t) => t.treatment_slug === filterSlug))
    : roster;
  const sortedRoster = [...shownRoster].sort((a, b) => {
    const am = skinMatches.some((p) => p.id === a.id) ? 0 : 1;
    const bm = skinMatches.some((p) => p.id === b.id) ? 0 : 1;
    return am - bm;
  });

  const languages = (storefront.languages ?? []).filter(Boolean);
  const accessibility = (storefront.accessibility ?? []).filter(Boolean);
  const booked = storefront.booked_count_30d ?? 0;
  const reviewed = storefront.review_count >= 3;

  const pillGroups = claimed
    ? [
        { label: "devices", items: storefront.devices ?? [] },
        { label: "product lines carried", items: storefront.product_lines ?? [] },
        { label: "peel depths", items: storefront.peel_depths ?? [] },
      ].filter((g) => g.items.length > 0)
    : [];

  const policies = claimed
    ? [
        { label: "cancellation", body: storefront.cancellation_policy },
        { label: "deposit", body: storefront.deposit_policy },
        { label: "late arrival", body: storefront.late_policy },
      ].filter((p) => Boolean(p.body))
    : [];

  const copyAddress = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullAddress).catch(() => undefined);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const scrollToRoster = () => {
    rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const initial = name.trim().charAt(0).toUpperCase() || "t";

  return (
    <div className={claimed ? "pb-36" : "pb-24"}>
      {/* section 1, the shopfront */}
      <header className="relative">
        {storefront.cover_url ? (
          <img
            src={storefront.cover_url}
            alt={`inside ${name}`}
            className="h-[240px] w-full object-cover"
          />
        ) : (
          <div className="h-[240px] w-full" style={{ backgroundColor: accent }} />
        )}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background: "linear-gradient(to bottom, rgba(17,17,17,0) 0%, rgba(17,17,17,0.32) 100%)",
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

        <div className="absolute left-5 -bottom-9">
          {storefront.logo_url ? (
            <img
              src={storefront.logo_url}
              alt={`${name} logo`}
              className="size-[72px] rounded-[18px] border-2 border-cream bg-cream object-cover"
            />
          ) : (
            <span
              className="grid size-[72px] place-items-center rounded-[18px] border-2 border-cream text-[32px] font-medium lowercase"
              style={{ backgroundColor: accent, color: "#111111" }}
            >
              {initial}
            </span>
          )}
        </div>
      </header>

      <div className="px-5 pt-12">
        <div className="flex items-start gap-1.5">
          <h1 className="min-w-0 text-[26px] font-medium leading-tight tracking-[-0.02em]">
            {name}
          </h1>
          {claimed && (
            <span
              className="mt-2 grid size-4 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: accent }}
            >
              <Check className="size-2.5" strokeWidth={3} style={{ color: onAccent }} />
            </span>
          )}
        </div>

        <p className="mt-1 text-[13px] lowercase text-ink/60">
          {[...tags, area].filter(Boolean).map((tag, i) => (
            <span key={`${tag}-${i}`}>
              {i > 0 && <span className="px-1 text-ink/30">·</span>}
              {tag}
            </span>
          ))}
        </p>

        {storefront.tagline && (
          <p className="mt-1.5 text-[13px] lowercase" style={{ color: accent }}>
            {noDash(storefront.tagline)}
          </p>
        )}
      </div>

      {/* section 2, the map strip */}
      <div className="px-5 pt-4">
        <StorefrontMapStrip
          lat={storefront.lat}
          lng={storefront.lng}
          accent={accent}
          distanceLabel={Number.isFinite(km) ? formatDistance(km) : null}
          mapsHref={mapsHref}
          name={name}
        />
      </div>

      {/* section 3, the info rows */}
      <div className="px-5 pt-4">
        <div className="overflow-hidden rounded-[18px] border border-line bg-cream">
          <InfoRow icon={MapPin} label={fullAddress}>
            <button
              type="button"
              onClick={copyAddress}
              aria-label="copy address"
              className="grid size-8 shrink-0 place-items-center"
            >
              <Copy className="size-4 text-ink/50" />
            </button>
          </InfoRow>

          {status && (
            <Expandable icon={Clock} label={status}>
              <ul className="pb-3">
                {week.map((d, i) => (
                  <li
                    key={d.key}
                    className={`flex items-center justify-between py-1 text-[13px] lowercase ${
                      i === today ? "font-semibold text-ink" : "text-ink/65"
                    }`}
                  >
                    <span>{d.label}</span>
                    <span>{d.text}</span>
                  </li>
                ))}
              </ul>
            </Expandable>
          )}

          <InfoRow
            icon={Star}
            label={
              reviewed
                ? `${storefront.rating.toFixed(1)} on treatme (${storefront.review_count} visits)`
                : "new to treatme"
            }
            sub={
              google?.rating !== null && google?.rating !== undefined
                ? `google ${google.rating.toFixed(1)}${google.count ? ` (${google.count})` : ""}`
                : undefined
            }
          >
            <Info className="size-4 shrink-0 text-ink/40" aria-hidden />
          </InfoRow>
          <p className="border-t border-line px-4 py-2 text-[11px] lowercase leading-relaxed text-ink/45">
            treatme ratings come only from verified visits booked through treatme
          </p>


          {booked > 10 && (
            <InfoRow icon={Users} label={`${booked} people booked here this month`} />
          )}

          {languages.length > 0 && (
            <InfoRow icon={Globe} label={noDash(languages.join(", "))} sub="spoken by the team" />
          )}

          {(storefront.parking || storefront.transit_note) && (
            <InfoRow
              icon={Car}
              label={storefront.parking ? noDash(storefront.parking) : "getting there"}
              sub={storefront.transit_note ? noDash(storefront.transit_note) : undefined}
            />
          )}

          {accessibility.length > 0 && (
            <Expandable icon={Accessibility} label={noDash(accessibility.join(", "))}>
              <ul className="pb-3">
                {accessibility.map((a) => (
                  <li key={a} className="py-1 text-[13px] lowercase text-ink/70">
                    {noDash(a)}
                  </li>
                ))}
              </ul>
            </Expandable>
          )}
        </div>
      </div>

      {/* section 4, who works here */}
      {claimed && roster.length > 0 && (
        <section ref={rosterRef} className="scroll-mt-4 px-5 pt-8">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[20px] font-medium lowercase tracking-[-0.02em]">who works here</h2>
            <span className="text-[13px] lowercase text-ink/50">{roster.length}</span>
          </div>

          {filterSlug && (
            <button
              type="button"
              onClick={() => setFilterSlug(null)}
              className="mt-2 inline-flex items-center gap-1 rounded-pill border border-line px-2.5 py-1 text-[12px] lowercase"
            >
              showing {noDash(treatments.find((t) => t.slug === filterSlug)?.name ?? "")}
              <X className="size-3" />
            </button>
          )}

          {filterSlug && treatments.find((t) => t.slug === filterSlug)?.listedOnSiteUrl && (
            <p className="mt-2 text-[12px] lowercase leading-relaxed text-ink/55">
              this treatment is listed on their website, the clinic has not confirmed it with us yet.
            </p>
          )}


          <div className="mt-3 space-y-3">
            {sortedRoster.map((p) => (
              <RosterEntry
                key={p.id}
                provider={p}
                storefrontId={storefront.id}
                km={km}
                accent={accent}
                onAccent={onAccent}
                matches={skinMatches.some((m) => m.id === p.id)}
              />
            ))}
            {sortedRoster.length === 0 && (
              <p className="text-[13px] lowercase text-ink/55">
                nobody here lists that treatment yet
              </p>
            )}
          </div>
        </section>
      )}

      {/* what they offer, directly under the roster */}
      <StorefrontOffers rows={treatments} onOpen={openTreatment} />

      {/* section 5, what they have on site */}
      {pillGroups.length > 0 && (
        <section className="px-5 pt-8">
          <h2 className="text-[20px] font-medium lowercase tracking-[-0.02em]">
            what they have on site
          </h2>
          {pillGroups.map((g) => (
            <div key={g.label} className="mt-3">
              <p className="text-[12px] lowercase text-ink/55">{g.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-pill px-2.5 py-1 text-[12px] lowercase text-ink"
                    style={{ backgroundColor: accentTint(accent, 0.25) }}
                  >
                    {noDash(item)}
                  </span>
                ))}
              </div>
              {g.label === "devices" && skinFitz !== null && skinFitz >= 4 && (
                <p className="mt-2 rounded-[14px] bg-mint px-3 py-2 text-[12px] lowercase leading-relaxed">
                  nd:yag is the wavelength to ask about for your skin type.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* section 6, the space */}
      {photos.length > 0 && (
        <section className="pt-8">
          <h2 className="px-5 text-[20px] font-medium lowercase tracking-[-0.02em]">the space</h2>
          <div className="mt-3 flex gap-2.5 overflow-x-auto px-5 no-scrollbar">
            {photos.map((ph) => (
              <button key={ph.id} type="button" onClick={() => setLightbox(ph.url)} className="shrink-0">
                <img
                  src={ph.url}
                  alt={ph.caption ? noDash(ph.caption) : `inside ${name}`}
                  loading="lazy"
                  className="h-[180px] w-[150px] rounded-[16px] object-cover"
                />
                {ph.caption && (
                  <span className="mt-1.5 block max-w-[150px] text-left text-[12px] lowercase text-ink/60">
                    {noDash(ph.caption)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* book here, a request and never a confirmed appointment */}
      <section className="px-5 pt-8">
        <h2 className="text-[20px] font-medium lowercase tracking-[-0.02em]">book here</h2>
        <p className="mt-1.5 text-[13.5px] lowercase leading-relaxed text-ink/60">
          tell us when suits you and we will arrange it with the clinic. you will hear back within one business day.
        </p>
        <Link
          to="/storefront/$id/request"
          params={{ id: storefront.id }}
          search={{ treatment: undefined }}
          className="mt-3.5 block w-full rounded-pill py-3.5 text-center text-[15px] font-semibold lowercase"
          style={{ backgroundColor: accent, color: onAccent }}
        >
          request a time
        </Link>
      </section>

      {/* section 8, good to know */}
      {policies.length > 0 && (
        <section className="px-5 pt-8">
          <h2 className="text-[20px] font-medium lowercase tracking-[-0.02em]">good to know</h2>
          <ul className="mt-3 space-y-2.5">
            {policies.map((p) => (
              <li key={p.label} className="text-[13px] lowercase leading-relaxed">
                <span className="text-ink/55">{p.label}: </span>
                {noDash(p.body ?? "")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* section 9, unclaimed */}
      {(!claimed || roster.length === 0) && (
        <section className="px-5 pt-8">
          <div
            className="rounded-[18px] p-5"
            style={{ border: `1px solid ${accentTint(accent, 0.55)}` }}
          >
            <p className="text-[16px] font-medium lowercase">do you work here?</p>
            <p className="mt-1.5 text-[13px] lowercase leading-relaxed text-ink/70">
              claim this storefront to add your team, your devices, and your booking
            </p>
            <Link
              to="/claim/$id"
              params={{ id: storefront.id }}
              className="mt-3 inline-block rounded-pill px-4 py-2 text-[13px] font-semibold lowercase"
              style={{ backgroundColor: accent, color: onAccent }}
            >
              claim this storefront
            </Link>
          </div>
        </section>
      )}

      {/* sticky bar, claimed only */}
      {claimed && (
        <div className="fixed inset-x-0 bottom-[62px] z-40 border-t border-line bg-cream/95 px-5 py-3 backdrop-blur">
          <Link
            to="/storefront/$id/request"
            params={{ id: storefront.id }}
            search={{ treatment: undefined }}
            className="block w-full rounded-pill py-3.5 text-center text-[15px] font-semibold lowercase"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            request a time
          </Link>
        </div>
      )}

      {copied && (
        <div
          role="status"
          className="fixed bottom-[130px] left-1/2 z-50 -translate-x-1/2 rounded-pill bg-ink px-3.5 py-2 text-[12px] lowercase text-cream"
        >
          copied
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-label="photo"
          className="fixed inset-0 z-[300] grid place-items-center bg-ink/95 px-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt={`inside ${name}`} className="max-h-[86vh] w-full object-contain" />
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

/** one scannable row: outline icon, bold label, optional grey sub line, trailing control. */
function InfoRow({
  icon: Icon,
  label,
  sub,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
      <Icon className="size-[18px] shrink-0 text-ink/70" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium lowercase leading-snug text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-[12px] lowercase leading-snug text-ink/55">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** the same row, with a chevron down that reveals more underneath. */
function Expandable({
  icon: Icon,
  label,
  sub,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Icon className="size-[18px] shrink-0 text-ink/70" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium lowercase leading-snug text-ink">{label}</span>
          {sub && <span className="mt-0.5 block text-[12px] lowercase leading-snug text-ink/55">{sub}</span>}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-4">{children}</div>}
    </div>
  );
}

/** the search tab provider card, with this clinic's own book button under it. */
function RosterEntry({
  provider,
  storefrontId,
  km,
  accent,
  onAccent,
  matches,
}: {
  provider: Provider;
  storefrontId: string;
  km: number;
  accent: string;
  onAccent: string;
  matches: boolean;
}) {
  return (
    <div>
      <ProviderCard provider={provider} km={km} shops={provider.storefronts} />
      <div className="mt-1.5 flex items-center gap-2 px-1">
        {matches && (
          <span className="rounded-pill bg-mint px-2.5 py-1 text-[11px] lowercase">
            matches your skin type
          </span>
        )}
        <Link
          to="/book/consult"
          search={{ storefrontId, providerId: provider.id }}
          className="ml-auto rounded-pill px-3.5 py-1.5 text-[12px] font-semibold lowercase"
          style={{ backgroundColor: accent, color: onAccent }}
        >
          book
        </Link>
      </div>
    </div>
  );
}
