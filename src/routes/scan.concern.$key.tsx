import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useScan } from "@/lib/scan-store";
import { supabase } from "@/integrations/supabase/client";
import { SCAN_CONCERN_LABEL, toConcernRows } from "@/lib/scan-concerns";
import { findIndicator, indicatorKey, skinIndicatorsQuery } from "@/lib/skin-indicators";
import { FaceMap } from "@/components/treatme/FaceMap";
import { MarkerOverlay, hasMarkers } from "@/components/treatme/MarkerOverlay";
import { ScanPhoto } from "@/components/treatme/ScanPhoto";
import { useScanPhotoSource } from "@/lib/scan-photo";
import { useTreatmentSheet } from "@/lib/treatment-sheet-store";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";
import { PillButton } from "@/components/treatme/PillButton";

export const Route = createFileRoute("/scan/concern/$key")({
  head: () => ({
    meta: [
      { title: "one indicator, up close · treatme" },
      { name: "description", content: "where this shows up on the face, what it means, and what tends to help." },
      { property: "og:title", content: "one indicator, up close · treatme" },
      { property: "og:description", content: "where this shows up on the face, what it means, and what tends to help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConcernDetailPage,
});

function useTreatmentNames(slugs: string[]) {
  const key = [...slugs].sort().join(",");
  return useQuery({
    queryKey: ["treatment-names", key],
    enabled: slugs.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("treatments").select("slug, name").in("slug", slugs);
      if (error) throw new Error(error.message);
      const map: Record<string, string> = {};
      for (const row of data ?? []) map[row.slug] = row.name;
      return map;
    },
  });
}

function ConcernDetailPage() {
  const { key } = Route.useParams();
  const navigate = useNavigate();
  const { result } = useScan();
  const photoSource = useScanPhotoSource();
  const { openTreatment } = useTreatmentSheet();

  const { data: indicators = [] } = useQuery(skinIndicatorsQuery());

  const rows = useMemo(() => (result ? toConcernRows(result) : []), [result]);
  const row = rows.find((r) => indicatorKey(r.concern_key) === indicatorKey(key));
  const indicator = findIndicator(indicators, key);
  const label = indicator?.name ?? SCAN_CONCERN_LABEL[key] ?? key.replace(/_/g, " ");

  const helps = indicator?.whatHelps ?? [];
  const { data: names = {} } = useTreatmentNames(helps);

  if (!row) {
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

  const score = row.score;
  const accent = indicator?.accent ?? "#F8A1C6";

  return (
    <div className="pt-4 pb-28">
      {/* indicator strip, ordered as the table orders them */}
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
            {indicators.map((i) => {
              const active = indicatorKey(i.slug) === indicatorKey(key);
              return (
                <button
                  key={i.slug}
                  type="button"
                  onClick={() => navigate({ to: "/scan/concern/$key", params: { key: i.slug } })}
                  className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold lowercase whitespace-nowrap border ${
                    active ? "bg-ink text-white border-ink" : "bg-white text-ink border-ink/20"
                  }`}
                >
                  {i.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* header */}
      <div className="mt-5 px-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <h1 className="min-w-0 brand-display text-[30px] leading-none lowercase">{label}</h1>
        <p className="shrink-0 font-bold text-[18px]">
          {score}
          <span className="text-ink-mute">/100</span>
        </p>
      </div>

      {/* your own photo with this indicator marked. the diagram is the fallback. */}
      <div className="mt-4 mx-6">
        {hasMarkers(row.regions) && photoSource.url ? (
          <ScanPhoto
            source={photoSource}
            alt={`your photo with ${label} marked`}
            className="w-full aspect-[4/5] rounded-2xl border border-ink/10"
          >
            <MarkerOverlay
              regions={row.regions}
              accent={accent}
              overlayKind={indicator?.overlayKind ?? "patches_soft"}
            />
          </ScanPhoto>
        ) : (
          <FaceMap
            overlayKind={indicator?.overlayKind ?? "patches_soft"}
            accent={accent}
            region={indicator?.region ?? "full_face"}
            score={score}
            className="w-full rounded-2xl"
          />
        )}
        <div className="mt-3 h-1.5 rounded-full bg-ink/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: accent }} />
        </div>
      </div>

      {/* what this means */}
      {indicator?.whatItMeans && (
        <div className="mt-6 mx-6 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="brand-eyebrow">what this means</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{indicator.whatItMeans}</p>
        </div>
      )}

      {/* what tends to help */}
      <div className="mt-4 mx-6 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="brand-eyebrow">what tends to help</h2>
        {helps.length === 0 ? (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            nothing we book targets this directly. worth raising at a consult.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {helps.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => openTreatment(slug)}
                className="h-9 px-4 rounded-full border border-ink/15 bg-cream text-[13px] font-semibold lowercase"
              >
                {(names[slug] ?? slug.replace(/-/g, " ")).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 px-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/scan/results" })}
          className="text-[13px] font-semibold lowercase underline underline-offset-4"
        >
          see all indicators
        </button>
      </div>

      <AnalysisFooter className="mt-6 px-6" />
    </div>
  );
}
