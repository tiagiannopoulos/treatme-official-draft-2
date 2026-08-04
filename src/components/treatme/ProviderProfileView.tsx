import { Link, notFound, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  MapPin,
  Star,
  Check,
  ShieldCheck,
  Sparkles,
  Bookmark,
  ChevronRight,
  ChevronDown,
  Droplet,
  Languages,
  Zap,
} from "lucide-react";

import { directoryQuery, distanceKm, formatDistance, TORONTO_CENTROID } from "@/lib/search-data";
import {
  providerResultsQuery,
  providerReviewsQuery,
  reviewDate,
  type ProviderResult,
} from "@/lib/provider-profile";
import { providerFit, fitzRoman } from "@/lib/provider-fit";
import { usePatient } from "@/lib/patient-store";
import { TreatmentSheet } from "@/components/treatme/TreatmentSheet";
import { ResultViewer } from "@/components/treatme/ResultViewer";
import { cn } from "@/lib/utils";

import type { Provider, ProviderTreatment } from "@/lib/search-data";

const SAVED_KEY = "treatme-saved-providers";

function useSavedProviders() {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      setSaved(new Set(Array.isArray(raw) ? raw : []));
    } catch {
      setSaved(new Set());
    }
  }, []);
  const toggle = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
      return next;
    });
  };
  return { saved, toggle };
}

export function ProviderProfileView({ match }: { match: (p: Provider) => boolean }) {
  const router = useRouter();
  const { data } = useSuspenseQuery(directoryQuery);
  const provider = data.providers.find(match);
  if (!provider) throw notFound();

  const { data: results } = useSuspenseQuery(providerResultsQuery(provider.id));
  const { data: reviews } = useSuspenseQuery(providerReviewsQuery(provider.id));
  const { saved, toggle } = useSavedProviders();
  const { profile } = usePatient();

  const [bioOpen, setBioOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"results" | "reviews">("results");
  const [filterSlug, setFilterSlug] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sheetSlug, setSheetSlug] = useState<string | null>(null);
  const [showAllStores, setShowAllStores] = useState(false);

  const sortedStores = [...provider.storefronts].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  );
  const visibleStores = showAllStores ? sortedStores : sortedStores.slice(0, 3);
  const hiddenStores = Math.max(0, sortedStores.length - 3);

  const resultCount = results.length;
  const treatmentCount = provider.treatments.length;
  const hasRating = provider.review_count >= 3;
  const away = sortedStores[0]
    ? formatDistance(distanceKm(TORONTO_CENTROID, { lat: sortedStores[0].lat, lng: sortedStores[0].lng }))
    : null;

  const nameFor = (slug: string) =>
    provider.treatments.find((t) => t.treatment_slug === slug)?.name ?? slug.replace(/-/g, " ");

  const signatureTreatments = provider.treatments.filter((t) => t.is_signature);
  const highlights =
    signatureTreatments.length > 0
      ? signatureTreatments
      : provider.treatments
          .filter((t) => results.some((r) => r.treatment_slug === t.treatment_slug))
          .slice(0, 5);

  const filteredResults = filterSlug
    ? results.filter((r) => r.treatment_slug === filterSlug)
    : results;

  const fit = providerFit(provider, profile);

  const credentials = [
    [provider.licensing_body, provider.license_number].filter(Boolean).join(" #"),
    provider.years_experience > 0 ? `${provider.years_experience} years practising` : "",
    provider.designations.length > 0 ? provider.designations.join(" · ").toLowerCase() : "",
    provider.specialties.length > 0 ? `trained in ${provider.specialties.join(", ")}` : "",
  ].filter((c): c is string => Boolean(c));

  const isSaved = saved.has(provider.id);
  const first = firstName(provider.name);

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
      </div>

      {/* section 1: header */}
      <div className="px-6 mt-4">
        <div className="flex items-center gap-5">
          <Avatar provider={provider} />
          <div className="flex-1 grid grid-cols-3 gap-2">
            <Stat count={resultCount} label="results" />
            <Stat count={treatmentCount} label="treatments" />
            <Stat label="rating" value={hasRating ? provider.rating.toFixed(1) : "new"} />
          </div>
        </div>

        <div className="mt-3">
          <h1 className="text-[20px] font-medium leading-[1.05] lowercase">{provider.name}</h1>
          <p className="text-[14px] text-ink-mute lowercase mt-0.5">
            {provider.credential_line || provider.credentials || provider.title}
          </p>
          {provider.license_verified && (
            <p className="mt-2 inline-flex items-center gap-1 text-[12px] lowercase text-ink-soft">
              <ShieldCheck className="size-3.5 text-hot shrink-0" />
              {licenseVerified(provider)}
            </p>
          )}
        </div>
      </div>

      {/* section 2: bio */}
      <section className="px-6 mt-4">
        <p
          className={cn(
            "text-[14px] leading-snug text-ink-soft lowercase",
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
            {bioOpen ? "read less" : "more"}
          </button>
        )}
        {provider.designations.length > 0 && (
          <p className="mt-2 text-[13px] text-ink-soft lowercase">
            {provider.designations.map((d) => d.toLowerCase()).join(" · ")}
          </p>
        )}
        <p className="mt-1 text-[12px] text-ink-mute lowercase">
          speaks {provider.languages.length > 0 ? provider.languages.join(", ").toLowerCase() : "english"}
        </p>
      </section>

      {/* section 3: where they work */}
      <section className="px-6 mt-4">
        <div className="flex flex-wrap gap-2">
          {visibleStores.map((s) => (
            <Link
              key={s.id}
              to="/storefront/$id"
              params={{ id: s.id }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] lowercase"
            >
              <MapPin className="size-3.5 text-hot" />
              {s.name.toLowerCase()}, {neighbourhood(s)}
              {away && <span className="text-ink-mute ml-1">{away}</span>}
            </Link>
          ))}
          {!showAllStores && hiddenStores > 0 && (
            <button
              type="button"
              onClick={() => setShowAllStores(true)}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[12px] lowercase text-ink-soft"
            >
              and {hiddenStores} more
            </button>
          )}
        </div>
      </section>

      {/* section 4: actions */}
      <section className="px-6 mt-4 flex gap-3">
        {provider.accepting_new ? (
          <Link
            to="/book/consult"
            search={{ providerId: provider.id, storefrontId: sortedStores[0]?.id }}
            className="flex-[3] flex items-center justify-center rounded-pill bg-hot text-cream py-3 text-[14px] font-semibold lowercase"
          >
            book a consult
          </Link>
        ) : (
          <span className="flex-[3] flex items-center justify-center rounded-pill border border-line text-ink-soft py-3 text-[14px] lowercase">
            not taking new patients
          </span>
        )}
        <button
          type="button"
          onClick={() => toggle(provider.id)}
          aria-pressed={isSaved}
          className={cn(
            "flex-1 flex items-center justify-center rounded-pill border py-3",
            isSaved ? "bg-bubblegum/40 border-bubblegum" : "border-line",
          )}
        >
          <Bookmark className={cn("size-4", isSaved && "fill-ink text-ink")} />
        </button>
      </section>

      {/* section 5: signature highlights */}
      {highlights.length > 0 && (
        <section className="mt-6">
          <div className="flex gap-5 overflow-x-auto no-scrollbar px-6">
            {highlights.map((t) => {
              const active = filterSlug === t.treatment_slug;
              return (
                <button
                  key={t.treatment_slug}
                  type="button"
                  onClick={() => setFilterSlug(active ? null : t.treatment_slug)}
                  className="flex shrink-0 flex-col items-center gap-1.5 w-16"
                >
                  <span
                    className={cn(
                      "size-16 rounded-full grid place-items-center border-[2px]",
                      active ? "border-hot" : "border-bubblegum",
                    )}
                  >
                    <Sparkles className="size-6 text-ink" />
                  </span>
                  <span className="text-[11px] leading-tight text-center lowercase line-clamp-2">
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* section 7: tabs */}
      <div className="mt-6 sticky top-0 z-10 bg-cream/95 backdrop-blur-sm px-6">
        <div className="flex border-b border-line">
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={cn(
              "flex-1 pb-2 text-[13px] lowercase",
              activeTab === "results" && "border-b-2 border-ink text-ink",
              activeTab !== "results" && "text-ink-mute",
            )}
          >
            results
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={cn(
              "flex-1 pb-2 text-[13px] lowercase",
              activeTab === "reviews" && "border-b-2 border-ink text-ink",
              activeTab !== "reviews" && "text-ink-mute",
            )}
          >
            reviews
          </button>
        </div>
      </div>

      {activeTab === "results" ? (
        <>
          {/* section 6: the grid */}
          {filteredResults.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-[2px] mx-[-1px]">
              {filteredResults.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setViewerIndex(i)}
                  className="relative aspect-square"
                >
                  <img
                    src={r.after_url}
                    alt={`${nameFor(r.treatment_slug)} after`}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 rounded-full bg-ink/50 text-cream p-1">
                    <SplitIcon />
                  </span>
                </button>
              ))}
            </div>
          ) : results.length < 3 ? (
            <div className="px-6 mt-4">
              <div className="rounded-2xl border border-line bg-cream p-5">
                <p className="text-[13px] lowercase text-ink-soft">
                  no results posted yet
                </p>
                <p className="text-[12px] lowercase text-ink-mute mt-1">
                  this provider has not published before and afters on treatme
                </p>
              </div>
            </div>
          ) : (
            <div className="px-6 mt-4">
              <p className="text-[13px] lowercase text-ink-mute">no results for this filter</p>
            </div>
          )}
        </>
      ) : (
        <section className="px-6 mt-4">
          {reviews.length < 3 ? (
            <p className="text-[13px] text-ink-mute lowercase">no reviews yet</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-line pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium lowercase">{initialName(r.reviewer_name)}</p>
                    <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
                      <Star className="size-3.5 fill-ink text-ink" />
                      {r.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-mute lowercase mt-0.5">
                    {r.treatment_name.toLowerCase()} · {reviewDate(r.reviewed_at)}
                  </p>
                  <p className="text-[13px] text-ink-soft lowercase leading-relaxed mt-1.5">{r.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* section 9: who this provider is right for */}
      {fit.length > 0 && (
        <section className="px-6 mt-5">
          <div className="rounded-2xl border border-line p-4 space-y-2">
            {fit.map((f) => {
              const Icon =
                f.icon === "language" ? Languages : f.icon === "device" ? Zap : f.icon === "treats" ? Sparkles : Droplet;
              return (
                <div
                  key={f.id}
                  className={cn(
                    "flex items-start gap-2 text-[13px] lowercase leading-snug",
                    f.tone === "match" && "text-ink",
                    f.tone !== "match" && "text-ink-soft",
                  )}
                >
                  <Icon className="mt-[2px] size-3.5 shrink-0 text-hot" />
                  <span>{f.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* section 8: details collapsed */}
      <section className="px-6 mt-6">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="w-full flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-[13px] lowercase"
        >
          credentials and details
          {detailsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {detailsOpen && (
          <div className="mt-3 space-y-3">
            {credentials.map((c) => (
              <p key={c} className="flex items-start gap-2 text-[13px] text-ink-soft lowercase">
                <Check className="size-3.5 text-hot mt-[3px] shrink-0" />
                {c}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              {provider.treatments.map((t) => (
                <button
                  key={t.treatment_slug}
                  type="button"
                  onClick={() => setSheetSlug(t.treatment_slug)}
                  className="rounded-pill border border-line px-3 py-1.5 text-[13px] lowercase"
                >
                  {t.name}
                  {t.price_from !== null && (
                    <span className="ml-1.5 text-hot">from ${t.price_from}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="px-6 mt-7 text-[11px] text-ink-mute lowercase leading-relaxed">
        provider details are supplied by the clinic. your provider confirms what is right for you at consult.
      </p>

      {/* sticky book bar */}
      {provider.accepting_new && (
        <div className="fixed bottom-[76px] inset-x-0 px-6 z-20">
          <Link
            to="/book/consult"
            search={{ providerId: provider.id, storefrontId: sortedStores[0]?.id }}
            className="flex items-center justify-center rounded-pill bg-hot text-cream py-3.5 text-[14px] font-semibold lowercase"
          >
            book a consult
          </Link>
        </div>
      )}

      {viewerIndex !== null && (
        <ResultViewer
          results={filterSlug ? filteredResults : results}
          index={viewerIndex}
          onIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          nameFor={nameFor}
          providerFirstName={first}
          providerId={provider.id}
          storefrontId={sortedStores[0]?.id}
        />
      )}

      {sheetSlug && <TreatmentSheet slug={sheetSlug} onClose={() => setSheetSlug(null)} />}
    </div>
  );
}

function Avatar({ provider }: { provider: Provider }) {
  const initials = provider.name
    .split(" ")
    .filter((w) => !w.toLowerCase().startsWith("dr"))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return provider.avatar_url ? (
    <img src={provider.avatar_url} alt={provider.name} className="size-[84px] rounded-full object-cover" />
  ) : (
    <span className="size-[84px] rounded-full bg-bubblegum/40 grid place-items-center text-[28px] font-medium">
      {initials}
    </span>
  );
}

function Stat({
  count,
  label,
  value,
}: {
  count?: number;
  label: string;
  value?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[18px] font-medium lowercase">{value !== undefined ? value : count}</p>
      <p className="text-[11px] text-ink-mute/55 lowercase mt-0.5">{label}</p>
    </div>
  );
}

function SplitIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
    </svg>
  );
}

function licenseVerified(p: Provider): string {
  const body = (p.licensing_body ?? "").trim().toLowerCase();
  const num = (p.license_number ?? "").trim();
  if (body && num) return `license verified · ${body} #${num}`;
  if (body) return `license verified · ${body}`;
  return "license verified";
}

function firstName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^dr\.?\s+/, "")
    .split(" ")[0];
}

function initialName(full: string): string {
  const parts = full.split(" ");
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  return `${first.toLowerCase()} ${last ? last[0].toUpperCase() + "." : ""}`.trim();
}

function neighbourhood(s: { neighbourhood: string | null; city: string; postcode: string }): string {
  return (s.neighbourhood || s.city || s.postcode).toLowerCase();
}
