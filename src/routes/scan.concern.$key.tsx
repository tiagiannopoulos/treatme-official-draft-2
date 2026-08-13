import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useScan } from "@/lib/scan-store";
import { useScanPhoto } from "@/lib/scan-photo";
import {
  SCAN_CONCERN_KEYS,
  SCAN_CONCERN_LABEL,
  bandFor,
  bandTint,
  toConcernRows,
} from "@/lib/scan-concerns";
import { CONCERN_SUBS } from "@/lib/scan-overlay";
import { CONCERN_ABOUT } from "@/lib/concern-copy";
import { treatmentsForOneConcern } from "@/lib/concern-treatments";
import { ConcernOverlay } from "@/components/treatme/ConcernOverlay";
import { PinchZoom } from "@/components/treatme/PinchZoom";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";
import { PillButton } from "@/components/treatme/PillButton";

export const Route = createFileRoute("/scan/concern/$key")({
  head: () => ({
    meta: [
      { title: "one indicator, up close · treatme" },
      { name: "description", content: "where this shows up on your face, what it means, and what treats it." },
      { property: "og:title", content: "one indicator, up close · treatme" },
      { property: "og:description", content: "where this shows up on your face, what it means, and what treats it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConcernDetailPage,
});

function ConcernDetailPage() {
  const { key } = Route.useParams();
  const navigate = useNavigate();
  const { result, landmarks } = useScan();
  const photoDataUrl = useScanPhoto();

  const [sub, setSub] = useState<string | null>(null);

  const rows = useMemo(() => (result ? toConcernRows(result) : []), [result]);
  const row = rows.find((r) => r.concern_key === key);
  const label = SCAN_CONCERN_LABEL[key] ?? key;

  const { data: treatments = [], isLoading } = useQuery({
    queryKey: ["concern-treatments-all", label],
    queryFn: () => treatmentsForOneConcern(label),
    staleTime: 5 * 60 * 1000,
  });

  if (!row || !photoDataUrl) {
    return (
      <div className="px-6 pt-12 text-center">
        <p className="brand-eyebrow">nothing to show</p>
        <h1 className="brand-display text-3xl mt-2">let's read your skin first.</h1>
        <div className="mt-6">
          <Link to="/scan">
            <PillButton>scan me</PillButton>
          </Link>
        </div>
      </div>
    );
  }

  const subs = CONCERN_SUBS[key] ?? [];
  const activeSub = subs.find((s) => s.key === sub) ?? null;
  const regionFilter = activeSub?.regions ?? null;

  const subScore =
    activeSub && row.region_scores
      ? Math.round(
          activeSub.regions.reduce((sum, r) => sum + (row.region_scores?.[r] ?? row.score), 0) /
            activeSub.regions.length,
        )
      : row.score;
  const shownScore = activeSub ? subScore : row.score;
  const shownBand = bandFor(shownScore);
  const tint = bandTint(shownBand);

  return (
    <div className="pt-4 pb-28">
      {/* tabs */}
      <div className="flex items-center gap-2 pl-4 pr-0">
        <button
          type="button"
          aria-label="back to your analysis"
          onClick={() => navigate({ to: "/scan/results" })}
          className="shrink-0 size-9 rounded-full border border-ink/20 grid place-items-center bg-white"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 pr-6">
            {SCAN_CONCERN_KEYS.map((k) => {
              const active = k === key;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setSub(null);
                    navigate({ to: "/scan/concern/$key", params: { key: k } });
                  }}
                  className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold lowercase whitespace-nowrap border ${
                    active ? "bg-ink text-white border-ink" : "bg-white text-ink border-ink/20"
                  }`}
                >
                  {SCAN_CONCERN_LABEL[k] ?? k}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* image */}
      <div className="mt-4 mx-6 relative rounded-3xl overflow-hidden bg-ink/5 aspect-[4/5]">
        <PinchZoom className="absolute inset-0">
          <img src={photoDataUrl} alt="your scan" className="absolute inset-0 w-full h-full object-cover" />
          {/* the overlay is the point of this screen, so it is always on. */}
          <ConcernOverlay
            concernKey={key}
            tint={tint}
            landmarks={landmarks}
            regionScores={row.region_scores}
            regionFilter={regionFilter}
          />
        </PinchZoom>
      </div>

      {/* sub concern pills */}
      {subs.length > 0 && (
        <div className="mt-3 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 px-6">
            <button
              type="button"
              onClick={() => setSub(null)}
              className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold lowercase border ${
                sub === null ? "bg-ink text-white border-ink" : "bg-white text-ink border-ink/20"
              }`}
            >
              all
            </button>
            {subs.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSub(s.key)}
                className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold lowercase whitespace-nowrap border ${
                  sub === s.key ? "bg-ink text-white border-ink" : "bg-white text-ink border-ink/20"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 mx-6 rounded-3xl border border-ink/10 bg-white p-5">
        <div className="flex items-center justify-end gap-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold lowercase"
            style={{ backgroundColor: tint }}
          >
            {shownBand}
          </span>
        </div>
        <p className="mt-2 font-bold text-[18px] lowercase leading-tight">
          {activeSub ? activeSub.label : label}
        </p>
        <p className="brand-display text-[46px] leading-none mt-2">
          {shownScore}
          <span className="text-[16px] text-ink-mute"> /100</span>
        </p>
        <div className="mt-4 h-2.5 rounded-full bg-ink/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${shownScore}%`, backgroundColor: tint }}
          />
        </div>
      </div>

      {/* about */}
      <div className="mt-4 mx-6 rounded-3xl border border-ink/10 bg-white p-5">
        <p className="brand-eyebrow">about {label}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{CONCERN_ABOUT[key]}</p>
      </div>

      {/* treatments */}
      <div className="mt-7 px-6">
        <h2 className="brand-display text-[22px] lowercase">
          treatments for {label}<span className="text-hot">.</span>
        </h2>

        {isLoading ? (
          <p className="mt-4 text-[14px] text-ink-mute">pulling matches.</p>
        ) : treatments.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-ink/10 bg-white p-5">
            <p className="text-[14px] leading-relaxed text-ink-soft">
              nothing we book treats this directly. worth raising at a consult.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/scan/chat" })}
              className="mt-3 text-[13px] font-semibold lowercase underline underline-offset-4"
            >
              talk it through
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {treatments.map((t) => (
              <article key={t.slug} className="rounded-3xl border border-ink/10 bg-white p-5">
                <p className="font-bold text-[17px] lowercase leading-tight">{t.name}</p>
                {t.shortDescription && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{t.shortDescription}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.priceFrom !== null && (
                    <span className="rounded-full bg-ink/5 px-3 py-1 text-[12px] font-semibold">
                      from ${Math.round(t.priceFrom)}
                    </span>
                  )}
                  {t.downtime && (
                    <span className="rounded-full bg-ink/5 px-3 py-1 text-[12px] font-semibold lowercase">
                      {t.downtime.toLowerCase()} downtime
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/match/$slug", params: { slug: t.slug } })}
                  className="mt-4 h-11 w-full rounded-full bg-ink text-white text-[14px] font-semibold lowercase"
                >
                  see providers
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <AnalysisFooter className="mt-6 px-6" />
    </div>
  );
}
