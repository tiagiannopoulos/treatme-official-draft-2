import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useScan } from "@/lib/scan-store";
import { toConcernRows, overallScore, bandFor, bandTint, SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";
import { treatmentsForConcerns } from "@/lib/concern-treatments";
import { ConcernOverlay } from "@/components/treatme/ConcernOverlay";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";
import { PillButton } from "@/components/treatme/PillButton";
import { buildResultsText, downloadResults } from "@/lib/scan-download";

export const Route = createFileRoute("/scan/results")({
  head: () => ({
    meta: [
      { title: "your analysis · treatme" },
      { name: "description", content: "your skin, read honestly. see every concern on your own face." },
      { property: "og:title", content: "your analysis · treatme" },
      { property: "og:description", content: "your skin, read honestly. see every concern on your own face." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const navigate = useNavigate();
  const { photoDataUrl, result, analysis, landmarks, medicalFlag } = useScan();

  const rows = useMemo(() => (result ? toConcernRows(result) : []), [result]);
  const ordered = useMemo(() => [...rows].sort((a, b) => a.score - b.score), [rows]);
  const overall = useMemo(() => (rows.length ? overallScore(rows) : 0), [rows]);

  const { data: matches = [] } = useQuery({
    queryKey: ["concern-treatments", ordered.map((r) => `${r.concern_key}:${r.score}`).join(",")],
    queryFn: () => treatmentsForConcerns(ordered, 5),
    enabled: ordered.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  if (!photoDataUrl || !result) {
    return (
      <div className="px-6 pt-12 text-center">
        <p className="brand-eyebrow">no scan yet</p>
        <h1 className="brand-display text-3xl mt-2">let's read your skin first.</h1>
        <div className="mt-6">
          <Link to="/scan">
            <PillButton>scan me</PillButton>
          </Link>
        </div>
      </div>
    );
  }

  const worst = ordered[0];
  const resultsText = buildResultsText(rows, analysis, overall);

  return (
    <div className="pt-4 pb-40">
      {/* header */}
      <div className="px-6 flex items-center justify-between gap-3">
        <h1 className="brand-display text-[30px]">your analysis<span className="text-hot">.</span></h1>
        <button
          type="button"
          onClick={() => navigate({ to: "/scan/capture" })}
          className="shrink-0 rounded-full border border-ink/25 px-4 h-9 text-[13px] font-semibold lowercase"
        >
          retake
        </button>
      </div>

      {medicalFlag && (
        <div
          className="mx-6 mt-4 rounded-2xl px-4 py-4 text-[14px] leading-snug text-ink"
          style={{ backgroundColor: "#FFEDB4" }}
        >
          there's something here worth having a doctor look at rather than an aesthetics provider.
        </div>
      )}

      {/* overview */}
      <div className="mt-5 px-6 grid grid-cols-2 gap-3">
        <OverviewCard label="skin type" value={analysis?.skinType ?? "unknown"} />
        <OverviewCard label="skin tone" value={analysis ? `fitzpatrick ${analysis.fitzpatrick}` : "unknown"} />
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">overall score</p>
          <p className="brand-display text-[38px] leading-none mt-2">
            {overall}
            <span className="text-[15px] text-ink-mute"> /100</span>
          </p>
          <p className="text-[13px] font-semibold mt-1 lowercase">{bandFor(overall)}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ backgroundColor: bandTint(worst.band) }}>
          <p className="text-[11px] font-bold tracking-widest uppercase text-ink/70">top concern</p>
          <p className="font-bold text-[18px] mt-2 lowercase leading-tight">
            {SCAN_CONCERN_LABEL[worst.concern_key]}
          </p>
          <p className="text-[13px] text-ink/70 mt-1">{worst.score}/100 · {worst.band}</p>
        </div>
      </div>

      {/* concern carousel */}
      <div className="mt-8">
        <div className="px-6">
          <p className="brand-eyebrow">every indicator</p>
          <h2 className="brand-display text-[24px] mt-2">lowest scores first<span className="text-hot">.</span></h2>
        </div>
        <div className="mt-4 overflow-x-auto scrollbar-none">
          <div className="flex gap-3 px-6 pb-2">
            {ordered.map((row) => (
              <article
                key={row.concern_key}
                className="shrink-0 w-[228px] rounded-3xl border border-ink/10 bg-white overflow-hidden"
              >
                <div className="relative aspect-[4/5] bg-ink/5">
                  <img src={photoDataUrl} alt="your scan" className="absolute inset-0 w-full h-full object-cover" />
                  {row.score >= 90 ? (
                    <span
                      className="absolute inset-x-3 bottom-3 rounded-full px-3 py-2 text-[12px] font-semibold text-center lowercase"
                      style={{ backgroundColor: "#DFFFF8" }}
                    >
                      nothing to flag
                    </span>
                  ) : (
                    <ConcernOverlay
                      concernKey={row.concern_key}
                      tint={bandTint(row.band)}
                      landmarks={landmarks}
                    />
                  )}
                </div>
                <div className="p-4">
                  <p className="font-bold text-[16px] lowercase leading-tight">
                    {SCAN_CONCERN_LABEL[row.concern_key]}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-[14px] font-semibold">
                      {row.score}
                      <span className="text-ink-mute text-[12px]"> /100</span>
                    </p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold lowercase"
                      style={{ backgroundColor: bandTint(row.band) }}
                    >
                      {row.band}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/scan/concern/$key", params: { key: row.concern_key } })}
                    className="mt-3 w-full h-10 rounded-full bg-ink text-cream text-[13px] font-semibold lowercase"
                  >
                    show more
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* treatments for you */}
      <div className="mt-8 px-6">
        <p className="brand-eyebrow">matched to your scores</p>
        <h2 className="brand-display text-[24px] mt-2">treatments for you<span className="text-hot">.</span></h2>

        <div className="mt-4 rounded-3xl border border-ink/10 bg-white divide-y divide-ink/10 overflow-hidden">
          {matches.length === 0 ? (
            <p className="p-5 text-[14px] text-ink-mute">
              we're lining up matches for your scores. check back in a moment.
            </p>
          ) : (
            matches.map((m) => (
              <button
                key={m.slug}
                type="button"
                onClick={() => navigate({ to: "/treatment/$slug", params: { slug: m.slug } })}
                className="w-full text-left px-4 py-4 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[16px] lowercase leading-tight">{m.name}</p>
                  <p className="text-[12px] text-ink-mute mt-0.5 lowercase">for {m.concernLabel}</p>
                </div>
                {m.priceFrom !== null && (
                  <p className="text-[13px] font-semibold shrink-0">from ${Math.round(m.priceFrom)}</p>
                )}
                <ChevronRight className="size-5 text-ink-mute shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      <AnalysisFooter className="mt-6 px-6" />

      {/* sticky actions */}
      <div className="fixed inset-x-0 bottom-[5.5rem] z-30 px-6 pb-3 pt-3 bg-gradient-to-t from-cream via-cream to-transparent">
        <PillButton fullWidth onClick={() => navigate({ to: "/scan/chat" })}>
          talk it through
        </PillButton>
        <div className="text-center mt-2">
          <button
            type="button"
            onClick={() => downloadResults(resultsText)}
            className="text-[13px] font-semibold text-ink-mute lowercase underline underline-offset-4"
          >
            download my results
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">{label}</p>
      <p className="font-bold text-[18px] mt-2 lowercase leading-tight">{value}</p>
    </div>
  );
}
