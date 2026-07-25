import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";

type TreatmentRow = {
  slug: string;
  name: string;
  category: string;
  improves: string[];
  price_from: number;
  what_it_is: string;
  what_to_expect: string;
  downtime: string;
  science: string;
  hero_image_url: string | null;
};

type BeforeAfter = {
  id: string;
  before_url: string;
  after_url: string;
  caption: string | null;
  provider_name: string | null;
  weeks_between: number | null;
  sort_order: number;
};

export const Route = createFileRoute("/treatments/$slug/story")({
  head: ({ params }) => ({
    meta: [
      { title: `${params?.slug?.replace(/-/g, " ") ?? "treatment"} · story · treatme` },
      { name: "description", content: "tap through everything about this treatment — before you book." },
    ],
  }),
  component: StoryPage,
});

type Panel =
  | { kind: "intro"; title: string; category: string; price: number; hero: string | null }
  | { kind: "what-it-is"; body: string }
  | { kind: "expect"; body: string }
  | { kind: "downtime"; body: string }
  | { kind: "improves"; tags: string[] }
  | { kind: "science"; body: string }
  | { kind: "ba"; ba: BeforeAfter }
  | { kind: "cta"; slug: string; price: number };

function StoryPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<TreatmentRow | null>(null);
  const [bas, setBas] = useState<BeforeAfter[]>([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: tr }, { data: b }] = await Promise.all([
        supabase.from("treatments").select("*").eq("slug", slug).maybeSingle(),
        supabase.from("treatment_before_afters").select("*").eq("treatment_slug", slug).order("sort_order"),
      ]);
      if (!alive) return;
      setT(tr as TreatmentRow | null);
      setBas((b as BeforeAfter[]) ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const panels: Panel[] = useMemo(() => {
    if (!t) return [];
    const out: Panel[] = [
      { kind: "intro", title: t.name, category: t.category, price: t.price_from, hero: t.hero_image_url },
      { kind: "what-it-is", body: t.what_it_is },
      { kind: "expect", body: t.what_to_expect },
      { kind: "downtime", body: t.downtime },
      { kind: "improves", tags: t.improves },
    ];
    if (t.science) out.push({ kind: "science", body: t.science });
    for (const ba of bas) out.push({ kind: "ba", ba });
    out.push({ kind: "cta", slug: t.slug, price: t.price_from });
    return out;
  }, [t, bas]);

  const total = panels.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((v) => Math.min(total - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
      if (e.key === "Escape") navigate({ to: "/treatments/$slug", params: { slug } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, slug, navigate]);

  const advance = () => setI((v) => Math.min(total - 1, v + 1));
  const back = () => setI((v) => Math.max(0, v - 1));

  if (loading) {
    return (
      <div className="fixed inset-0 bg-ink text-cream grid place-items-center text-[13px] lowercase">
        loading…
      </div>
    );
  }

  if (!t) {
    return (
      <div className="fixed inset-0 bg-ink text-cream grid place-items-center flex-col gap-4">
        <p className="lowercase">treatment not found.</p>
        <Link to="/treatments" className="underline text-[13px]">back to treatments</Link>
      </div>
    );
  }

  const p = panels[i];

  return (
    <div className="fixed inset-0 bg-ink text-cream flex flex-col">
      {/* progress bars */}
      <div className="px-3 pt-3 flex gap-1">
        {panels.map((_, idx) => (
          <div key={idx} className="h-[3px] flex-1 rounded-full bg-cream/25 overflow-hidden">
            <div
              className={`h-full bg-cream transition-all ${
                idx < i ? "w-full" : idx === i ? "w-full" : "w-0"
              }`}
            />
          </div>
        ))}
      </div>

      {/* header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-cream/60">{t.category}</p>
          <p className="text-[14px] font-bold lowercase">{t.name}</p>
        </div>
        <button
          onClick={() => navigate({ to: "/treatments/$slug", params: { slug } })}
          className="size-9 rounded-full bg-cream/10 grid place-items-center"
          aria-label="close"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* body — tap zones */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 flex">
          <button className="w-1/3 h-full" onClick={back} aria-label="previous" />
          <button className="w-2/3 h-full" onClick={advance} aria-label="next" />
        </div>
        <div className="relative z-[1] h-full pointer-events-none">
          <PanelView panel={p} />
        </div>
      </div>

      {/* nav hints */}
      <div className="px-4 pb-5 pt-2 flex items-center justify-between text-cream/50 text-[11px] lowercase">
        <span className="inline-flex items-center gap-1">
          <ChevronLeft className="size-3.5" /> tap left
        </span>
        <span>
          {i + 1} / {total}
        </span>
        <span className="inline-flex items-center gap-1">
          tap right <ChevronRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

function PanelView({ panel }: { panel: Panel }) {
  switch (panel.kind) {
    case "intro":
      return (
        <div className="h-full w-full relative">
          {panel.hero && (
            <img src={panel.hero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/40 to-ink" />
          <div className="relative h-full flex flex-col justify-end p-6 pb-10">
            <p className="text-[11px] uppercase tracking-widest text-cream/70">{panel.category}</p>
            <h1 className="brand-display text-[44px] leading-[0.95] mt-2 lowercase">
              {panel.title}<span className="text-hot">.</span>
            </h1>
            <p className="mt-3 text-cream/80 text-[13px]">from <span className="text-cream font-bold">${panel.price}</span></p>
          </div>
        </div>
      );
    case "what-it-is":
      return <StoryText eyebrow="what it is" body={panel.body} />;
    case "expect":
      return <StoryText eyebrow="what to expect" body={panel.body} />;
    case "downtime":
      return <StoryText eyebrow="downtime" body={panel.body} accent="bubblegum" />;
    case "improves":
      return (
        <div className="h-full flex flex-col justify-center p-8">
          <p className="text-[11px] uppercase tracking-widest text-cream/60">improves</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {panel.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-mint text-ink px-3 py-1.5 text-[13px] font-semibold lowercase">
                {tag}
              </span>
            ))}
          </div>
        </div>
      );
    case "science":
      return <StoryText eyebrow="the science" body={panel.body} accent="mint" />;
    case "ba":
      return (
        <div className="h-full flex flex-col p-4 pb-6">
          <p className="text-[11px] uppercase tracking-widest text-cream/60 px-2">before · after</p>
          <div className="mt-3 flex-1 grid grid-cols-2 gap-2 min-h-0">
            <BAImage label="before" url={panel.ba.before_url} />
            <BAImage label="after" url={panel.ba.after_url} />
          </div>
          <div className="mt-4 px-2">
            {panel.ba.caption && <p className="text-[14px] font-semibold lowercase">{panel.ba.caption}</p>}
            <p className="text-[12px] text-cream/60 mt-1 lowercase">
              {panel.ba.provider_name}{panel.ba.weeks_between ? ` · ${panel.ba.weeks_between} weeks` : ""}
            </p>
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="h-full flex flex-col justify-center items-center p-8 text-center">
          <p className="text-[11px] uppercase tracking-widest text-cream/60">ready?</p>
          <h2 className="brand-display text-[40px] leading-[0.95] mt-3 lowercase">
            find a verified provider<span className="text-hot">.</span>
          </h2>
          <p className="mt-3 text-cream/70 text-[13px]">first visit is always a free 15-min consult.</p>
          <div className="mt-6 flex flex-col gap-3 w-full max-w-xs pointer-events-auto">
            <Link to="/treatments/$slug/book" params={{ slug: panel.slug }}>
              <PillButton fullWidth>book treatment</PillButton>
            </Link>
            <Link
              to="/treatments/$slug"
              params={{ slug: panel.slug }}
              className="text-[13px] lowercase text-cream/70 underline underline-offset-4"
            >
              full details
            </Link>
          </div>
        </div>
      );
  }
}

function StoryText({ eyebrow, body, accent }: { eyebrow: string; body: string; accent?: "bubblegum" | "mint" }) {
  const bg = accent === "bubblegum" ? "bg-bubblegum/25" : accent === "mint" ? "bg-mint/20" : "bg-cream/5";
  return (
    <div className="h-full flex flex-col justify-center p-8">
      <div className={`rounded-3xl p-6 ${bg}`}>
        <p className="text-[11px] uppercase tracking-widest text-cream/70">{eyebrow}</p>
        <p className="mt-3 text-[18px] leading-snug text-cream lowercase">{body}</p>
      </div>
    </div>
  );
}

function BAImage({ label, url }: { label: string; url: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-cream/5">
      <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
      <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest bg-ink/70 text-cream px-2 py-0.5 rounded-full">
        {label}
      </span>
    </div>
  );
}
