import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, RefreshCcw } from "lucide-react";
import { useScan } from "@/lib/scan-store";
import { MARKER_KEYS, MARKER_LABEL, ZONE_POINTS, type MarkerKey } from "@/lib/skin-analysis";
import { getTreatment } from "@/lib/treatments-data";
import { useTreatmentStory } from "@/lib/treatment-story-store";
import { PillButton } from "@/components/treatme/PillButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan/results")({
  head: () => ({
    meta: [
      { title: "your scan · treatme" },
      { name: "description", content: "your skin, read honestly. tap any marker to see it on your face." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { photoDataUrl, analysis } = useScan();
  const navigate = useNavigate();
  const [active, setActive] = useState<MarkerKey | "all" | "none">("none");

  if (!photoDataUrl || !analysis) {
    return (
      <div className="px-6 pt-12 text-center">
        <p className="brand-eyebrow">no scan yet</p>
        <h1 className="brand-display text-3xl mt-2">let's read your skin first.</h1>
        <div className="mt-6">
          <Link to="/scan"><PillButton>scan me</PillButton></Link>
        </div>
      </div>
    );
  }

  const markers = analysis.markers;
  const dots = useMemo(() => {
    const chosen: MarkerKey[] = active === "all" ? [...MARKER_KEYS] : active === "none" ? [] : [active];
    return chosen.flatMap((key) => {
      const m = markers[key];
      return (m.zones ?? []).map((zone, i) => ({
        key: `${key}-${zone}-${i}`,
        marker: key,
        ...ZONE_POINTS[zone],
      }));
    });
  }, [active, markers]);

  return (
    <div className="pt-4 pb-10">
      <div className="px-6">
        <p className="brand-eyebrow">your read</p>
        <h1 className="brand-display text-[32px] mt-2 text-balance">
          three things are doing<br/>most of the talking<span className="text-hot">.</span>
        </h1>
      </div>

      {/* photo + overlay */}
      <div className="mt-4 mx-6 relative rounded-3xl overflow-hidden bg-ink/5 aspect-[4/5]">
        <img src={photoDataUrl} alt="your scan" className="absolute inset-0 w-full h-full object-cover" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          {dots.map((d) => (
            <g key={d.key}>
              <circle cx={d.x * 100} cy={d.y * 100} r="3.2" fill="#FF1F87" opacity="0.85" />
              <circle cx={d.x * 100} cy={d.y * 100} r="5.5" fill="none" stroke="#FF1F87" strokeWidth="0.6" opacity="0.6">
                <animate attributeName="r" values="3.2;7;3.2" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start text-[11px] font-semibold">
          <span className="bg-ink text-cream rounded-full px-3 py-1">skin age · {analysis.skinAge}</span>
          <span className="bg-cream/90 text-ink rounded-full px-3 py-1">fitzpatrick · {analysis.fitzpatrick}</span>
        </div>
      </div>

      {/* marker chips */}
      <div className="mt-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 px-6 pb-1">
          <Chip label="overview" active={active === "none"} onClick={() => setActive("none")} />
          <Chip label="show all" active={active === "all"} onClick={() => setActive("all")} accent />
          <Chip label={`skin type · ${analysis.skinType}`} muted />
          {MARKER_KEYS.map((k) => (
            <Chip
              key={k}
              label={`${MARKER_LABEL[k]} · ${Math.round(markers[k].score)}`}
              active={active === k}
              onClick={() => setActive(active === k ? "none" : k)}
            />
          ))}
        </div>
      </div>

      {/* the read */}
      <div className="mt-6 px-6">
        <p className="brand-eyebrow">the read</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{analysis.blurb}</p>

        {active !== "none" && active !== "all" && (
          <div className="mt-4 rounded-2xl bg-bubblegum/35 border border-bubblegum/60 p-4">
            <p className="text-[11px] font-bold tracking-widest uppercase text-ink/70">{MARKER_LABEL[active]} · {Math.round(markers[active].score)}/100</p>
            <p className="mt-2 text-[14px] text-ink leading-relaxed">{markers[active].note}</p>
          </div>
        )}
      </div>

      {/* strengths / weaknesses */}
      <div className="mt-6 px-6 grid grid-cols-2 gap-3">
        <Pillars title="strengths" tone="mint" items={analysis.strengths} />
        <Pillars title="to work on" tone="bubblegum" items={analysis.weaknesses} />
      </div>

      {/* chat cta */}
      <div className="mt-6 mx-6 rounded-2xl bg-ink text-cream p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-cream/60">talk it through</p>
          <p className="font-bold text-[17px] mt-1">chat with treatme</p>
          <p className="text-[12px] text-cream/70">ask anything about treatments — like talking to a derm.</p>
        </div>
        <Link to="/scan/chat" className="size-12 rounded-full bg-hot text-white grid place-items-center shrink-0">
          <MessageCircle className="size-5" />
        </Link>
      </div>

      {/* recommended treatments */}
      <div className="mt-8 px-6">
        <p className="brand-eyebrow">recommended for you</p>
        <h2 className="brand-display text-[24px] mt-2">your tx, matched<span className="text-hot">.</span></h2>
        <div className="mt-4 flex flex-col gap-3">
          {analysis.recommendedTreatments.map((slug) => {
            const t = getTreatment(slug);
            if (!t) return null;
            return (
              <button
                type="button"
                onClick={() => openStory(slug)}
                key={slug}
                className="text-left rounded-2xl bg-card border border-line p-4 flex items-center justify-between hover:border-ink/40 transition"
              >
                <div className="pr-3">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">{t.category}</p>
                  <p className="font-bold text-[16px] mt-1">{t.name}</p>
                  <p className="text-[12px] text-ink-mute mt-1">good for {t.improves.slice(0, 3).map((k) => MARKER_LABEL[k as MarkerKey] ?? k).join(" · ")}</p>
                </div>
                <ArrowRight className="size-5 text-ink shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 px-6">
        <button onClick={() => navigate({ to: "/scan" })} className="inline-flex items-center gap-2 text-ink-mute text-[13px] font-semibold lowercase">
          <RefreshCcw className="size-3.5" /> scan again
        </button>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick, accent, muted }: { label: string; active?: boolean; onClick?: () => void; accent?: boolean; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 h-8 text-[12px] font-semibold lowercase border transition",
        muted && "bg-butter border-butter text-ink/80 cursor-default",
        !muted && (active
          ? accent ? "bg-hot text-white border-hot" : "bg-ink text-cream border-ink"
          : "bg-cream border-line text-ink-soft hover:border-ink/40"),
      )}
    >{label}</button>
  );
}

function Pillars({ title, tone, items }: { title: string; tone: "mint" | "bubblegum"; items: string[] }) {
  const bg = tone === "mint" ? "bg-mint" : "bg-bubblegum/40";
  return (
    <div className={`rounded-2xl ${bg} p-4`}>
      <p className="text-[11px] font-bold tracking-widest uppercase text-ink/70">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-[13px] text-ink/85 leading-snug">· {s}</li>
        ))}
      </ul>
    </div>
  );
}
