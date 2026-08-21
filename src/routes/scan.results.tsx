import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Check } from "lucide-react";
import { useScan } from "@/lib/scan-store";
import { toConcernRows, overallScore, bandTint, SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";
import { treatmentsForConcerns, bestTreatmentByImproves } from "@/lib/concern-treatments";
import { ConcernOverlay } from "@/components/treatme/ConcernOverlay";
import { useScanPhotoSource } from "@/lib/scan-photo";
import { ScanPhoto } from "@/components/treatme/ScanPhoto";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";
import { SharePdfSheet } from "@/components/treatme/SharePdfSheet";
import { SaveTreatmentButton } from "@/components/treatme/SaveTreatmentButton";
import { fetchSavedScan } from "@/lib/scan-history";
import { getRecommendations } from "@/lib/recommendations";
import { topConcerns } from "@/lib/skinAnalysis";
import { FaceMap } from "@/components/treatme/FaceMap";
import { findIndicator, skinIndicatorsQuery } from "@/lib/skin-indicators";


export const Route = createFileRoute("/scan/results")({
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search.id === "string" ? { id: search.id } : {},
  head: () => ({
    meta: [
      { title: "analysis results · treatme" },
      { name: "description", content: "your skin, read honestly. see every concern on your own face." },
      { property: "og:title", content: "analysis results · treatme" },
      { property: "og:description", content: "your skin, read honestly. see every concern on your own face." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const navigate = useNavigate();
  const { id: requestedId } = Route.useSearch();
  const { result, analysis, landmarks, scanId, hydrate, setResult } = useScan();
  const photoSource = useScanPhotoSource();
  const [shareOpen, setShareOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(requestedId && requestedId !== scanId));
  const loadedFor = useRef<string | null>(null);

  // reopening a saved scan from the profile tab: pull the stored read back in.
  useEffect(() => {
    if (!requestedId || requestedId === scanId || loadedFor.current === requestedId) return;
    loadedFor.current = requestedId;
    let alive = true;
    setLoading(true);
    void (async () => {
      const saved = await fetchSavedScan(requestedId);
      if (!alive) return;
      if (!saved) {
        setLoading(false);
        return;
      }
      hydrate({
        scanId: saved.scanId,
        photoDataUrl: null,
        photoPath: saved.photoPath,
        landmarks: saved.landmarks,
        result: saved.result,
        analysis: saved.analysis,
        medicalFlag: saved.medicalFlag,
        photoQuality: saved.photoQuality,
        recommendations: [],
        goalRecommendations: [],
      });
      if (saved.result) {
        const { scanDriven, goalDriven } = await getRecommendations(topConcerns(saved.result), []);
        if (alive) setResult(saved.result, scanDriven, goalDriven);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [requestedId, scanId, hydrate, setResult]);

  const rows = useMemo(() => (result ? toConcernRows(result) : []), [result]);
  const ordered = useMemo(() => [...rows].sort((a, b) => a.score - b.score), [rows]);
  const overall = useMemo(() => (rows.length ? overallScore(rows) : 0), [rows]);
  const { data: indicators = [] } = useQuery(skinIndicatorsQuery());

  const worst = ordered[0];

  const { data: matches = [] } = useQuery({
    queryKey: ["concern-treatments", ordered.map((r) => `${r.concern_key}:${r.score}`).join(",")],
    queryFn: () => treatmentsForConcerns(ordered, 5),
    enabled: ordered.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // best treatment for the top concern, matched against the improves array.
  const { data: topSlug } = useQuery({
    queryKey: ["best-treatment-improves", worst?.concern_key],
    queryFn: () => bestTreatmentByImproves(SCAN_CONCERN_LABEL[worst!.concern_key] ?? worst!.concern_key),
    enabled: !!worst,
    staleTime: 5 * 60 * 1000,
  });

  if (loading) {
    return (
      <div className="px-6 pt-16 text-center">
        <p className="text-[15px] lowercase text-ink-mute">loading your saved scan...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="px-6 pt-12 text-center">
        <p className="brand-eyebrow">no scan yet</p>
        <h1 className="brand-display text-3xl mt-2">let's read your skin first.</h1>
        <div className="mt-6">
          <Link to="/scan">
            <span className="inline-flex items-center justify-center rounded-full bg-ink text-cream h-12 px-6 font-semibold lowercase">
              scan me
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const openTopConcern = () => {
    if (!worst) return;
    const label = SCAN_CONCERN_LABEL[worst.concern_key] ?? worst.concern_key;
    if (topSlug) {
      navigate({ to: "/match/$slug", params: { slug: topSlug } });
    } else {
      navigate({ to: "/search", search: { q: label, scope: undefined } });
    }
  };

  return (
    <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      {/* header */}
      <header
        className="px-6 flex items-center justify-between gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <h1 className="brand-display text-[26px] lowercase">analysis results</h1>
        <button
          type="button"
          onClick={() => navigate({ to: "/scan/capture" })}
          className="shrink-0 rounded-full border border-ink/25 px-4 h-9 text-[13px] font-semibold lowercase"
        >
          retake
        </button>
      </header>

      {/* stat cards */}
      <div className="mt-4 px-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-[12px] lowercase text-ink">skin type</p>
          <p className="font-bold text-[19px] mt-2 lowercase leading-tight">
            {analysis?.skinType ?? "unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-[12px] lowercase text-ink">skin tone</p>
          <p className="font-bold text-[19px] mt-2 lowercase leading-tight">
            {analysis ? `fitzpatrick ${analysis.fitzpatrick.toLowerCase()}` : "unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-[12px] lowercase text-ink">overall score</p>
          <p className="brand-display text-[34px] leading-none mt-2">
            {overall}
            <span className="text-[15px] text-ink-mute">/100</span>
          </p>
        </div>
        {worst && (
          <button
            type="button"
            onClick={openTopConcern}
            className="text-left rounded-2xl p-4"
            style={{ backgroundColor: "#FFEDB4" }}
          >
            <p className="text-[12px] lowercase text-ink">top concern</p>
            <p className="font-bold text-[18px] mt-2 lowercase leading-tight">
              {SCAN_CONCERN_LABEL[worst.concern_key]}
            </p>
            <p className="text-[13px] text-ink/70 mt-1">{worst.score}/100</p>
          </button>
        )}
      </div>




      {/* the detail */}
      <div className="mt-8">
        <div className="px-6">
          <h2 className="brand-display text-[24px] lowercase">the detail</h2>
          <p className="text-[13px] text-ink/55 mt-1 lowercase">indicator by indicator, lowest first</p>
        </div>
        <div className="mt-4 overflow-x-auto scrollbar-none">
          <div className="flex gap-3 px-6 pb-2">
            {ordered.map((row) => {
              const ind = findIndicator(indicators, row.concern_key);
              return (
                <button
                  key={row.concern_key}
                  type="button"
                  onClick={() => navigate({ to: "/scan/concern/$key", params: { key: ind?.slug ?? row.concern_key } })}
                  className="text-left shrink-0 w-[112px]"
                >
                  <FaceMap
                    compact
                    overlayKind={ind?.overlayKind ?? "patches_soft"}
                    accent={ind?.accent ?? "#F8A1C6"}
                    region={ind?.region ?? "full_face"}
                    score={row.score}
                    className="w-[112px] rounded-2xl border border-ink/10"
                  />
                  <p className="mt-2 text-[13px] font-semibold lowercase leading-tight">
                    {ind?.name ?? SCAN_CONCERN_LABEL[row.concern_key]}
                  </p>
                  <p className="text-[12px] text-ink/55">{row.score}/100</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* recommended for you */}
      <div className="mt-8 px-6">
        <p className="brand-eyebrow">matched to your scores</p>
        <h2 className="brand-display text-[24px] mt-2 lowercase">recommended for you</h2>

        <div className="mt-4 rounded-3xl border border-ink/10 bg-white divide-y divide-ink/10 overflow-hidden">
          {matches.length === 0 ? (
            <p className="p-5 text-[14px] text-ink-mute">
              we're lining up matches for your scores. check back in a moment.
            </p>
          ) : (
            matches.map((m) => (
              <div key={m.slug} className="flex items-center gap-2 pr-3">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/match/$slug", params: { slug: m.slug } })}
                  className="min-w-0 flex-1 text-left px-4 py-4 flex items-center gap-3"
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
                <SaveTreatmentButton slug={m.slug} name={m.name} size={18} className="size-9 shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>

      <AnalysisFooter className="mt-6 px-6" />

      {/* saved + download links */}
      <div className="px-6 mt-4 flex items-center justify-center gap-5">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 text-[13px] text-ink/55 lowercase"
        >
          <Check className="size-3.5" aria-hidden="true" />
          saved to your profile
        </Link>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="text-[13px] text-ink/55 lowercase underline underline-offset-4"
        >
          download
        </button>
      </div>

      {/* sticky consult bar */}
      <div
        className="fixed inset-x-0 z-30 px-6 pt-4 pb-3 bg-gradient-to-t from-cream via-cream to-transparent"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => navigate({ to: "/scan/chat" })}
          className="w-full h-12 rounded-full text-[15px] font-semibold lowercase text-cream"
          style={{ backgroundColor: "#FF1F87" }}
        >
          start my consult
        </button>
      </div>

      <SharePdfSheet open={shareOpen} onOpenChange={setShareOpen} scanId={scanId} analysis={analysis} />
    </div>
  );
}
