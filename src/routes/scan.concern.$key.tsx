import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useScan } from "@/lib/scan-store";
import {
  CONCERN_GROUPS,
  SCAN_CONCERN_LABEL,
  bandTint,
  toConcernRows,
} from "@/lib/scan-concerns";
import { treatmentsForConcerns } from "@/lib/concern-treatments";
import { ConcernOverlay } from "@/components/treatme/ConcernOverlay";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";
import { PillButton } from "@/components/treatme/PillButton";
import type { MarkerKey } from "@/lib/skin-analysis";

export const Route = createFileRoute("/scan/concern/$key")({
  head: () => ({
    meta: [
      { title: "one indicator, up close · treatme" },
      { name: "description", content: "where this shows up on your face, what it means, and what helps." },
      { property: "og:title", content: "one indicator, up close · treatme" },
      { property: "og:description", content: "where this shows up on your face, what it means, and what helps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConcernDetailPage,
});

/** which vision marker note best explains each canonical concern */
const NOTE_SOURCE: Record<string, MarkerKey> = {
  pores: "pores",
  breakouts: "texture",
  texture: "texture",
  oiliness: "pores",
  redness: "redness",
  pigmentation: "pigmentation",
  uniformness: "darkSpots",
  radiance: "hydration",
  lines: "fineLines",
  firmness: "volumeLoss",
  volume_loss: "volumeLoss",
  hydration: "hydration",
  dark_circles: "darkSpots",
  under_eye_puffiness: "darkSpots",
  tear_trough: "volumeLoss",
  eyelid_heaviness: "wrinkles",
};

function groupLabelFor(key: string) {
  return CONCERN_GROUPS.find((g) => (g.concerns as readonly string[]).includes(key))?.label ?? "";
}

function ConcernDetailPage() {
  const { key } = Route.useParams();
  const navigate = useNavigate();
  const { photoDataUrl, result, analysis, landmarks } = useScan();

  const rows = useMemo(() => (result ? toConcernRows(result) : []), [result]);
  const row = rows.find((r) => r.concern_key === key);

  const { data: matches = [] } = useQuery({
    queryKey: ["concern-treatments-one", key],
    queryFn: () => (row ? treatmentsForConcerns([row], 4) : Promise.resolve([])),
    enabled: Boolean(row),
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

  const label = SCAN_CONCERN_LABEL[row.concern_key] ?? row.concern_key;
  const marker = analysis?.markers[NOTE_SOURCE[row.concern_key] ?? "texture"];
  const sub = row.sub_scores ? Object.entries(row.sub_scores) : [];

  return (
    <div className="pt-5 pb-28">
      <div className="px-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/scan/results" })}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-mute lowercase"
        >
          <ChevronLeft className="size-4" /> your analysis
        </button>
        <p className="brand-eyebrow mt-4">{groupLabelFor(row.concern_key)}</p>
        <h1 className="brand-display text-[30px] mt-2 lowercase">
          {label}<span className="text-hot">.</span>
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-[16px] font-semibold">
            {row.score}
            <span className="text-ink-mute text-[13px]"> /100</span>
          </p>
          <span
            className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold lowercase"
            style={{ backgroundColor: bandTint(row.band) }}
          >
            {row.band}
          </span>
        </div>
      </div>

      <div className="mt-4 mx-6 relative rounded-3xl overflow-hidden bg-ink/5 aspect-[4/5]">
        <img src={photoDataUrl} alt="your scan" className="absolute inset-0 w-full h-full object-cover" />
        {row.score >= 90 ? (
          <span
            className="absolute inset-x-4 bottom-4 rounded-full px-3 py-2 text-[13px] font-semibold text-center lowercase"
            style={{ backgroundColor: "#DFFFF8" }}
          >
            nothing to flag
          </span>
        ) : (
          <ConcernOverlay concernKey={row.concern_key} tint={bandTint(row.band)} landmarks={landmarks} />
        )}
      </div>

      {marker?.note && (
        <div className="mt-5 mx-6 rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">what we see</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft lowercase">{marker.note.toLowerCase()}</p>
        </div>
      )}

      {sub.length > 0 && (
        <div className="mt-4 mx-6 grid grid-cols-2 gap-3">
          {sub.map(([name, score]) => (
            <div key={name} className="rounded-2xl p-4" style={{ backgroundColor: bandTint(row.band) }}>
              <p className="text-[11px] font-bold tracking-widest uppercase text-ink/70">{name} lines</p>
              <p className="brand-display text-[26px] mt-1 leading-none">{score}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7 px-6">
        <p className="brand-eyebrow">what helps</p>
        <h2 className="brand-display text-[22px] mt-2">treatments for {label}<span className="text-hot">.</span></h2>
        <div className="mt-4 rounded-3xl border border-ink/10 bg-white divide-y divide-ink/10 overflow-hidden">
          {matches.length === 0 ? (
            <p className="p-5 text-[14px] text-ink-mute">nothing matched here yet.</p>
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

      <div className="mt-6 px-6">
        <PillButton fullWidth onClick={() => navigate({ to: "/scan/chat" })}>
          talk it through
        </PillButton>
      </div>

      <AnalysisFooter className="mt-6 px-6" />
    </div>
  );
}
