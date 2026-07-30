import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, RefreshCcw } from "lucide-react";
import { useScan } from "@/lib/scan-store";
import { CONCERN_LABEL, type ConcernKey } from "@/lib/skinAnalysis";
import { CONCERN_ZONES, FACE_POINTS } from "@/lib/skinAnalysis/zones";
import { useTreatmentStory } from "@/lib/treatment-story-store";
import { PillButton } from "@/components/treatme/PillButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan/results")({
  head: () => ({
    meta: [
      { title: "your scan · treatme" },
      { name: "description", content: "your skin, read honestly. tap any marker to see it on your face." },
      { property: "og:title", content: "your scan · treatme" },
      { property: "og:description", content: "your skin, read honestly. tap any marker to see it on your face." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { photoDataUrl, result, recommendations } = useScan();
  const navigate = useNavigate();
  const { open: openStory } = useTreatmentStory();
  const [active, setActive] = useState<ConcernKey | "all" | "none">("none");

  const concerns = useMemo(
    () => (result ? [...result.concerns].sort((a, b) => b.score - a.score) : []),
    [result],
  );

  const dots = useMemo(() => {
    if (!result) return [];
    const chosen: ConcernKey[] =
      active === "all"
        ? concerns.filter((c) => c.score >= 50).map((c) => c.key)
        : active === "none"
          ? []
          : [active];
    return chosen.flatMap((key) =>
      CONCERN_ZONES[key].map((p, i) => ({ id: `${key}-${p}-${i}`, ...FACE_POINTS[p] })),
    );
  }, [active, concerns, result]);

  if (!photoDataUrl || !result) {
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

  const top = concerns.filter((c) => c.score >= 50);
  const strengths = concerns.filter((c) => c.score < 35).slice(0, 3);

  return (
    <div className="pt-4 pb-10">
      <div className="px-6">
        <p className="brand-eyebrow">your read</p>
        <h1 className="brand-display text-[32px] mt-2 text-balance">
          {top.length || "a few"} things are doing<br />most of the talking<span className="text-hot">.</span>
        </h1>
      </div>

      {/* photo + overlay */}
      <div className="mt-4 mx-6 relative rounded-3xl overflow-hidden bg-ink/5 aspect-[4/5]">
        <img src={photoDataUrl} alt="your scan" className="absolute inset-0 w-full h-full object-cover" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          {dots.map((d) => (
            <g key={d.id}>
              <circle cx={d.x * 100} cy={d.y * 100} r="3.2" fill="#FF1F87" opacity="0.85" />
              <circle cx={d.x * 100} cy={d.y * 100} r="5.5" fill="none" stroke="#FF1F87" strokeWidth="0.6" opacity="0.6">
                <animate attributeName="r" values="3.2;7;3.2" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start text-[11px] font-semibold">
          <span className="bg-ink text-cream rounded-full px-3 py-1">scan · {result.scan_id.slice(0, 6)}</span>
          {!result.image_quality.ok && (
            <span className="bg-cream/90 text-ink rounded-full px-3 py-1">photo quality low</span>
          )}
        </div>
      </div>

      {/* concern chips */}
      <div className="mt-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 px-6 pb-1">
          <Chip label="overview" active={active === "none"} onClick={() => setActive("none")} />
          <Chip label="show all" active={active === "all"} onClick={() => setActive("all")} accent />
          {concerns.map((c) => (
            <Chip
              key={c.key}
              label={`${CONCERN_LABEL[c.key]} · ${Math.round(c.score)}`}
              active={active === c.key}
              onClick={() => setActive(active === c.key ? "none" : c.key)}
            />
          ))}
        </div>
      </div>

      {/* the read */}
      <div className="mt-6 px-6">
        <p className="brand-eyebrow">the read</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          your scan flags{" "}
          {top.slice(0, 3).map((c) => CONCERN_LABEL[c.key]).join(", ") || "nothing loud"}{" "}
          as the loudest signals. tap any marker above to see where it sits on your face.
        </p>
      </div>

      {/* strengths / to work on */}
      <div className="mt-6 px-6 grid grid-cols-2 gap-3">
        <Pillars title="strengths" tone="mint" items={strengths.map((c) => CONCERN_LABEL[c.key])} />
        <Pillars title="to work on" tone="bubblegum" items={top.slice(0, 4).map((c) => CONCERN_LABEL[c.key])} />
      </div>

      {/* chat cta */}
      <div className="mt-6 mx-6 rounded-2xl bg-ink text-cream p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-cream/60">talk it through</p>
          <p className="font-bold text-[17px] mt-1">chat with treatme</p>
          <p className="text-[12px] text-cream/70">ask anything about treatments, like talking to a derm.</p>
        </div>
        <Link to="/scan/chat" className="size-12 rounded-full bg-hot text-white grid place-items-center shrink-0">
          <MessageCircle className="size-5" />
        </Link>
      </div>

      {/* scan-driven matches */}
      <div className="mt-8 px-6">
        <p className="brand-eyebrow">matched to your scan</p>
        <h2 className="brand-display text-[24px] mt-2">your treatment matches<span className="text-hot">.</span></h2>

        {recommendations.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            {recommendations.map((t) => (
              <TreatmentCard key={t.slug} rec={t} onOpen={() => openStory(t.slug)} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-mint p-5">
            <p className="font-bold text-[16px]">your skin is in good shape.</p>
            <p className="text-[13px] text-ink/75 mt-1">nothing is loud enough to need treating right now.</p>
            <Link to="/treatments" className="mt-3 inline-flex items-center gap-2 text-[13px] font-bold lowercase">
              explore the full library <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>

      {/* goal-driven matches */}
      {goalRecommendations.length > 0 && (
        <div className="mt-8 px-6">
          <div className="rounded-3xl bg-butter p-5">
            <p className="brand-eyebrow text-ink/70">you asked for this</p>
            <h2 className="brand-display text-[22px] mt-2">based on your goals<span className="text-hot">.</span></h2>
            <p className="text-[12px] text-ink/70 mt-1">picked from what you told us you want, not from the scan.</p>
            <div className="mt-4 flex flex-col gap-3">
              {goalRecommendations.map((t) => (
                <TreatmentCard key={t.slug} rec={t} onOpen={() => openStory(t.slug)} tone="butter" />
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mt-5 px-6 text-[11px] leading-relaxed text-ink-mute">
        these are educational matches, not a diagnosis. your provider confirms what's right for you at consult.
      </p>


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
