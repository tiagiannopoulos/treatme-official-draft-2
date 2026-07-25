import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTreatment, type Treatment } from "@/lib/treatments-data";
import { useTreatmentStory } from "@/lib/treatment-story-store";

type SlideType =
  | "hook"
  | "what_it_is"
  | "how_it_works"
  | "what_to_expect"
  | "downtime"
  | "results"
  | "pricing"
  | "cta";

type Overlay = "cream_scrim" | "butter_scrim" | "mint_scrim" | "bubblegum_scrim" | "none";

type Slide = {
  type: SlideType;
  headline: string;
  body?: string;
  chips?: string[];
  tone: Overlay;
  onDark?: boolean;
  media?: string;
};

type BeforeAfter = {
  id: string;
  before_url: string;
  after_url: string;
  caption: string | null;
  provider_name: string | null;
  weeks_between: number | null;
};

const SLIDE_DURATION_MS = 6000;

// no em-dashes anywhere in copy
const clean = (s: string) => s.replace(/—/g, ",").replace(/–/g, "-");

function toneClass(tone: Overlay) {
  switch (tone) {
    case "cream_scrim": return "bg-cream";
    case "butter_scrim": return "bg-butter";
    case "mint_scrim": return "bg-mint";
    case "bubblegum_scrim": return "bg-bubblegum/70";
    default: return "bg-cream";
  }
}

function buildSlides(t: Treatment, beforeAfters: BeforeAfter[], priceFrom: number): Slide[] {
  const slides: Slide[] = [
    {
      type: "hook",
      headline: clean(t.name.toLowerCase()),
      body: clean(t.category.toLowerCase()),
      chips: [t.downtime.toLowerCase().startsWith("none") ? "no downtime" : "minimal downtime"],
      tone: "bubblegum_scrim",
    },
    {
      type: "what_it_is",
      headline: "what it is.",
      body: clean(t.whatItIs.toLowerCase()),
      tone: "cream_scrim",
    },
    {
      type: "what_to_expect",
      headline: "what to expect.",
      body: clean(t.whatToExpect.toLowerCase()),
      tone: "butter_scrim",
    },
    {
      type: "downtime",
      headline: "downtime.",
      body: clean(t.downtime.toLowerCase()),
      chips: t.improves.slice(0, 3).map((i) => i.toLowerCase()),
      tone: "mint_scrim",
    },
  ];

  if (beforeAfters.length > 0) {
    slides.push({
      type: "results",
      headline: "real results.",
      tone: "cream_scrim",
    });
  }

  slides.push({
    type: "pricing",
    headline: "what it really costs.",
    body: `from $${priceFrom} at clinics near you.`,
    tone: "bubblegum_scrim",
  });

  slides.push({
    type: "cta",
    headline: "ready when you are.",
    body: "providers near you offer this.",
    tone: "butter_scrim",
  });

  return slides;
}

export function TreatmentStory() {
  const { slug, close } = useTreatmentStory();
  if (!slug) return null;
  return <StoryInner slug={slug} onClose={close} />;
}

function StoryInner({ slug, onClose }: { slug: string; onClose: () => void }) {
  const treatment = getTreatment(slug);
  const navigate = useNavigate();

  const { data: beforeAfters = [] } = useQuery({
    queryKey: ["treatment-before-afters", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_before_afters")
        .select("id, before_url, after_url, caption, provider_name, weeks_between")
        .eq("treatment_slug", slug)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BeforeAfter[];
    },
    staleTime: 60_000,
  });

  const slides = useMemo(
    () => (treatment ? buildSlides(treatment, beforeAfters, treatment.priceFrom) : []),
    [treatment, beforeAfters],
  );

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // reset progress on slide change
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();
  }, [index]);

  // rAF loop
  useEffect(() => {
    if (slides.length === 0) return;
    const tick = (now: number) => {
      if (!paused) {
        const delta = now - startRef.current;
        const total = elapsedRef.current + delta;
        const pct = Math.min(1, total / SLIDE_DURATION_MS);
        setProgress(pct);
        if (pct >= 1) {
          if (index >= slides.length - 1) {
            onClose();
            return;
          }
          setIndex((i) => i + 1);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, index, slides.length, onClose]);

  // pause bookkeeping
  useEffect(() => {
    if (paused) {
      elapsedRef.current += performance.now() - startRef.current;
    } else {
      startRef.current = performance.now();
    }
  }, [paused]);

  // preload next image (before/after or media)
  useEffect(() => {
    const next = slides[index + 1];
    if (!next) return;
    const urls: string[] = [];
    if (next.type === "results" && beforeAfters[0]) {
      urls.push(beforeAfters[0].before_url, beforeAfters[0].after_url);
    }
    if (next.media) urls.push(next.media);
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
  }, [index, slides, beforeAfters]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length]);

  function advance() {
    if (index >= slides.length - 1) onClose();
    else setIndex((i) => i + 1);
  }
  function back() {
    if (index === 0) return;
    setIndex((i) => i - 1);
  }

  // gesture handling: tap zones, hold-to-pause, swipe-down-to-close
  const holdTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const heldRef = useRef(false);

  function onPointerDown(e: ReactPointerEvent) {
    heldRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    holdTimerRef.current = window.setTimeout(() => {
      heldRef.current = true;
      setPaused(true);
    }, 220);
  }
  function onPointerUp(e: ReactPointerEvent) {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (heldRef.current) {
      setPaused(false);
      heldRef.current = false;
      return;
    }
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = performance.now() - start.t;
    // swipe down
    if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.3) {
      onClose();
      return;
    }
    // treat as tap if quick and small movement
    if (dt < 400 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      if (relX < rect.width / 3) back();
      else advance();
    }
  }
  function onPointerCancel() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (heldRef.current) {
      setPaused(false);
      heldRef.current = false;
    }
    pointerStartRef.current = null;
  }

  if (!treatment || slides.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-cream grid place-items-center" onClick={onClose}>
        <p className="text-ink-mute lowercase">not available.</p>
      </div>
    );
  }

  const slide = slides[index];
  const inkColor = slide.onDark ? "text-cream" : "text-ink";

  return (
    <div className="fixed inset-0 z-[100] bg-cream md:bg-cream md:grid md:place-items-center">
      {/* phone frame on desktop */}
      <div
        className="relative w-full h-full md:w-[420px] md:h-[860px] md:rounded-[36px] md:overflow-hidden md:shadow-2xl bg-cream select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* full-bleed media */}
        <div className={`absolute inset-0 ${toneClass(slide.tone)}`} aria-hidden />
        {/* scrim @ ~60% for legibility over any imagery — solid tone provides base */}
        <div className="absolute inset-0 bg-cream/0" aria-hidden />

        {/* progress segments */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {slides.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 rounded-full bg-ink/15 overflow-hidden">
              <div
                className="h-full bg-ink"
                style={{
                  width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                  transition: i === index ? "none" : "width 120ms linear",
                }}
              />
            </div>
          ))}
        </div>

        {/* close */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute top-7 right-4 z-30 size-9 grid place-items-center rounded-full bg-ink/10 backdrop-blur"
          aria-label="close"
        >
          <X className={`size-5 ${inkColor}`} />
        </button>

        {/* content */}
        <div className={`relative z-10 h-full flex flex-col px-6 pt-16 pb-10 ${inkColor}`}>
          <p className="brand-eyebrow lowercase tracking-[0.18em] text-[11px]">
            {slide.type.replace(/_/g, " ")}
          </p>

          {slide.type === "results" ? (
            <ResultsSlide items={beforeAfters} onInteract={() => setPaused(true)} onRelease={() => setPaused(false)} />
          ) : slide.type === "cta" ? (
            <CtaSlide
              treatment={treatment}
              onFindProviders={() => { onClose(); navigate({ to: "/treatments" }); }}
              onScanFirst={() => { onClose(); navigate({ to: "/scan" }); }}
            />
          ) : (
            <div className="mt-6 flex-1 flex flex-col">
              <h2
                className="text-[40px] leading-[1.02] tracking-tight lowercase font-bold"
                style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
              >
                {slide.headline}
              </h2>
              {slide.body && (
                <p className="mt-4 text-[15px] leading-snug lowercase max-w-[92%] line-clamp-3">
                  {slide.body}
                </p>
              )}
              {slide.chips && slide.chips.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {slide.chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-ink/8 backdrop-blur px-3 py-1 text-[11px] font-semibold lowercase"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsSlide({
  items,
  onInteract,
  onRelease,
}: {
  items: BeforeAfter[];
  onInteract: () => void;
  onRelease: () => void;
}) {
  const [active, setActive] = useState(0);
  const item = items[active];
  const [pos, setPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);

  function handleMove(clientX: number) {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }

  return (
    <div className="mt-4 flex-1 flex flex-col">
      <h2
        className="text-[36px] leading-[1.02] tracking-tight lowercase font-bold"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
      >
        real results.
      </h2>
      <div
        ref={sliderRef}
        className="mt-5 relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-ink/5"
        onPointerDown={(e) => {
          e.stopPropagation();
          onInteract();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          handleMove(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleMove(e.clientX);
        }}
        onPointerUp={(e) => { e.stopPropagation(); onRelease(); }}
        onPointerCancel={onRelease}
      >
        <img src={item.after_url} alt="after" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img src={item.before_url} alt="before" className="absolute inset-0 w-full h-full object-cover" style={{ width: `${(100 / pos) * 100}%`, maxWidth: "none" }} />
        </div>
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-cream shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
          style={{ left: `calc(${pos}% - 1px)` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-9 rounded-full bg-cream shadow-lg grid place-items-center">
            <span className="text-ink text-[10px] font-bold lowercase">drag</span>
          </div>
        </div>
        <span className="absolute top-3 left-3 rounded-full bg-ink/70 text-cream text-[10px] font-semibold px-2 py-0.5 lowercase">before</span>
        <span className="absolute top-3 right-3 rounded-full bg-cream/85 text-ink text-[10px] font-semibold px-2 py-0.5 lowercase">after</span>
      </div>
      <div className="mt-3 text-[12px] text-ink-mute lowercase">
        {clean(item.caption ?? "")}
        {item.weeks_between ? ` · ${item.weeks_between} weeks` : ""}
        {item.provider_name ? ` · ${item.provider_name.toLowerCase()}` : ""}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setActive(i); setPos(50); }}
              className={`h-1.5 flex-1 rounded-full ${i === active ? "bg-ink" : "bg-ink/20"}`}
              aria-label={`result ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CtaSlide({
  onFindProviders,
  onScanFirst,
}: {
  treatment: Treatment;
  onFindProviders: () => void;
  onScanFirst: () => void;
}) {
  return (
    <div className="mt-6 flex-1 flex flex-col">
      <h2
        className="text-[44px] leading-[1.02] tracking-tight lowercase font-bold"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
      >
        ready when you are.
      </h2>
      <p className="mt-3 text-[15px] lowercase text-ink">providers near you offer this.</p>
      <div className="flex-1" />
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onFindProviders(); }}
        className="w-full h-14 rounded-full bg-ink text-cream font-semibold lowercase tracking-tight text-[16px]"
      >
        find providers
      </button>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onScanFirst(); }}
        className="mt-3 w-full text-[13px] font-semibold underline lowercase text-ink-soft"
      >
        scan first
      </button>
    </div>
  );
}
