import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, BadgeCheck, Star } from "lucide-react";

import { useScan } from "@/lib/scan-store";
import { usePatient } from "@/lib/patient-store";
import { toConcernRows, SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";
import { formatDistance } from "@/lib/search-data";
import {
  matchSubline,
  treatmentMatchQuery,
  type MatchClinic,
  type MatchProvider,
} from "@/lib/treatment-match";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";

export const Route = createFileRoute("/match/$slug")({
  head: () => ({
    meta: [
      { title: "matched for you · treatme" },
      {
        name: "description",
        content: "providers and clinics matched to your skin, your city and your budget.",
      },
      { property: "og:title", content: "matched for you · treatme" },
      {
        property: "og:description",
        content: "providers and clinics matched to your skin, your city and your budget.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatchScreen,
});

function MatchScreen() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { result } = useScan();
  const { profile } = usePatient();

  const radiusKm = profile.travelKm ?? 10;

  const concerns = useMemo(() => {
    if (!result) return [];
    return [...toConcernRows(result)]
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .map((r) => SCAN_CONCERN_LABEL[r.concern_key] ?? r.concern_key);
  }, [result]);

  const { data, isLoading } = useQuery(
    treatmentMatchQuery(slug, {
      concerns,
      center: matchCenter,
      radiusKm,
      budget: profile.budget,
    }),
  );

  function book(providerId?: string, storefrontId?: string) {
    navigate({
      to: "/book/consult",
      search: { treatmentSlug: slug, providerId, storefrontId },
    });
  }

  const subline = data
    ? matchSubline(data.providers.length, concerns[0] ?? null, radiusKm, profile.budget, data.treatmentName)
    : "";

  return (
    <div className="pt-4 pb-32">
      <div className="px-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/treatment/$slug", params: { slug } })}
          aria-label="back"
          className="-ml-2 grid size-9 place-items-center rounded-full border border-ink/15"
        >
          <ArrowLeft className="size-4" />
        </button>
        <p className="brand-eyebrow">matched for you</p>
      </div>

      <div className="mt-3 px-6">
        <h1 className="brand-display text-[30px] lowercase leading-tight">
          {data ? data.treatmentName : "finding your match"}
          <span className="text-hot">.</span>
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft lowercase">
          {isLoading ? "pulling providers near you." : subline}
        </p>
      </div>

      {/* providers */}
      <section className="mt-7 px-6">
        <h2 className="brand-display text-[22px] lowercase">
          providers
        </h2>

        {isLoading ? (
          <p className="mt-3 text-[14px] text-ink-mute lowercase">looking.</p>
        ) : !data?.providers.length ? (
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft lowercase">
            no one near you lists this yet. worth raising at a consult.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.providers.map((p) => (
              <ProviderCard key={p.id} provider={p} onBook={() => book(p.id, p.clinicId)} />
            ))}
          </div>
        )}
      </section>

      {/* clinics */}
      <section className="mt-8 px-6">
        <h2 className="brand-display text-[22px] lowercase">
          clinics
        </h2>

        {isLoading ? (
          <p className="mt-3 text-[14px] text-ink-mute lowercase">looking.</p>
        ) : !data?.clinics.length ? (
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft lowercase">
            nowhere near you lists this yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.clinics.map((c) => (
              <ClinicCard key={c.id} clinic={c} onBook={() => book(undefined, c.id)} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 px-6 text-center">
        <Link
          to="/scan/chat"
          search={{ treatment: slug }}
          className="text-[13px] font-semibold lowercase underline underline-offset-4"
        >
          not quite right? refine with chat
        </Link>
      </div>

      <AnalysisFooter className="mt-6 px-6" />
    </div>
  );
}

function BookPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 h-11 w-full rounded-full bg-ink text-white text-[14px] font-semibold lowercase"
    >
      book consult
    </button>
  );
}

function ProviderCard({ provider, onBook }: { provider: MatchProvider; onBook: () => void }) {
  return (
    <article className="rounded-3xl border border-ink/10 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-full bg-ink/5">
          {provider.avatarUrl ? (
            <img src={provider.avatarUrl} alt={provider.name} className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <Link
            to="/provider/$id"
            params={{ id: provider.id }}
            className="block font-bold text-[17px] lowercase leading-tight break-words"
          >
            {provider.name}
          </Link>
          <p className="text-[13px] text-ink-soft lowercase">{provider.specialty}</p>
          <Link
            to="/storefront/$id"
            params={{ id: provider.clinicId }}
            className="mt-1 block text-[13px] lowercase text-ink-mute underline underline-offset-2"
          >
            {provider.clinicName}
            {provider.neighbourhood ? ` · ${provider.neighbourhood}` : ""}
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {provider.rating !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 text-[12px] font-semibold">
            <Star className="size-3.5 fill-ink" /> {provider.rating.toFixed(1)}
          </span>
        ) : (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold lowercase"
            style={{ backgroundColor: "#DFFFF8" }}
          >
            new to treatme
          </span>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft lowercase">{provider.why}</p>

      <BookPill onClick={onBook} />
    </article>
  );
}

function ClinicCard({ clinic, onBook }: { clinic: MatchClinic; onBook: () => void }) {
  return (
    <article className="rounded-3xl border border-ink/10 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/storefront/$id"
          params={{ id: clinic.id }}
          className="min-w-0 font-bold text-[17px] lowercase leading-tight break-words"
        >
          {clinic.name}
        </Link>
        {clinic.claimed ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold lowercase text-ink-mute">
            <BadgeCheck className="size-4" /> verified clinic
          </span>
        ) : (
          <span className="shrink-0 text-[12px] font-semibold lowercase text-ink-mute">unclaimed</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-ink/5 px-3 py-1 text-[12px] font-semibold lowercase">
          {clinic.neighbourhood}
        </span>
        <span className="rounded-full bg-ink/5 px-3 py-1 text-[12px] font-semibold lowercase">
          {formatDistance(clinic.distanceKm)} away
        </span>
        {clinic.priceFrom !== null && (
          <span className="rounded-full bg-ink/5 px-3 py-1 text-[12px] font-semibold lowercase">
            from ${Math.round(clinic.priceFrom)}
          </span>
        )}
      </div>

      <BookPill onClick={onBook} />
    </article>
  );
}
