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
  | "science"
  | "what_to_expect"
  | "downtime"
  | "results"
  | "pricing"
  | "cta";

type Overlay = "cream_scrim" | "butter_scrim" | "mint_scrim" | "bubblegum_scrim" | "none";

type DbSlide = {
  id: string;
  slide_order: number;
  slide_type: SlideType;
  headline: string;
  body: string | null;
  detail_chips: string[];
  media_url: string | null;
  media_overlay: Overlay;
};

type BeforeAfter = {
  id: string;
  before_url: string;
  after_url: string;
  caption: string | null;
  provider_name: string | null;
  weeks_between: number | null;
};

type Slide = DbSlide & {
  resolvedMedia: string | null;
};

const SLIDE_DURATION_MS = 6000;

// scrub em/en dashes anywhere just in case
const clean = (s: string | null | undefined) =>
  (s ?? "").replace(/—/g, ",").replace(/–/g, "-");

function toneClass(tone: Overlay) {
  switch (tone) {
    case "cream_scrim": return "bg-cream/60";
    case "butter_scrim": return "bg-butter/70";
    case "mint_scrim": return "bg-mint/65";
    case "bubblegum_scrim": return "bg-bubblegum/60";
    default: return "";
  }
}

function toneBase(tone: Overlay) {
  switch (tone) {
    case "cream_scrim": return "bg-cream";
    case "butter_scrim": return "bg-butter";
    case "mint_scrim": return "bg-mint";
    case "bubblegum_scrim": return "bg-bubblegum/70";
    default: return "bg-cream";
  }
}

export function TreatmentStory() {
  const { slug, close } = useTreatmentStory();
  if (!slug) return null;
  return <StoryInner slug={slug} onClose={close} />;
}

function StoryInner({ slug, onClose }: { slug: string; onClose: () => void }) {
  const treatment = getTreatment(slug);
  const navigate = useNavigate();

  const { data: dbSlides = [] } = useQuery({
    queryKey: ["treatment-story-slides", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_story_slides")
        .select("id, slide_order, slide_type, headline, body, detail_chips, media_url, media_overlay")
        .eq("treatment_slug", slug)
        .order("slide_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbSlide[];
    },
    staleTime: 5 * 60_000,
  });

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

  // Assemble final slide list:
  // - use DB slides as source of truth for hook/what_it_is/how_it_works/science/what_to_expect/downtime/pricing/cta
  // - inject a results slide before pricing IF approved before/afters exist
  // - drop any DB results slide if no approved content
  // - resolve hero media from the treatment for hook when DB row has no media_url
  const slides = useMemo<Slide[]>(() => {
    if (!treatment) return [];
    const filtered = dbSlides.filter((s) => {
      if (s.slide_type === "results") return beforeAfters.length > 0;
      return true;
    });
    const withMedia: Slide[] = filtered.map((s) => ({
      ...s,
      resolvedMedia: s.media_url ?? (s.slide_type === "hook" ? treatment.heroImage : null),
    }));
    // Ensure results slide is present when we have content
    if (beforeAfters.length > 0 && !withMedia.some((s) => s.slide_type === "results")) {
      const pricingIdx = withMedia.findIndex((s) => s.slide_type === "pricing");
      const insertAt = pricingIdx === -1 ? withMedia.length : pricingIdx;
      withMedia.splice(insertAt, 0, {
        id: "results-synth",
        slide_order: -1,
        slide_type: "results",
        headline: "real results.",
        body: null,
        detail_chips: [],
        media_url: null,
        media_overlay: "cream_scrim",
        resolvedMedia: null,
      });
    }
    return withMedia;
  }, [treatment, dbSlides, beforeAfters]);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();
  }, [index]);

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

  useEffect(() => {
    if (paused) {
      elapsedRef.current += performance.now() - startRef.current;
    } else {
      startRef.current = performance.now();
    }
  }, [paused]);

  // preload next slide's media + first before/after pair when the next slide is results
  useEffect(() => {
    const next = slides[index + 1];
    if (!next) return;
    const urls: string[] = [];
    if (next.slide_type === "results" && beforeAfters[0]) {
      urls.push(beforeAfters[0].before_url, beforeAfters[0].after_url);
    }
    if (next.resolvedMedia) urls.push(next.resolvedMedia);
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
  }, [index, slides, beforeAfters]);

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
    if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.3) {
      onClose();
      return;
    }
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
        <p className="text-ink-mute lowercase">loading story...</p>
      </div>
    );
  }

  const slide = slides[index];

  // resolve pricing body from treatment.priceFrom
  const bodyText =
    slide.slide_type === "pricing"
      ? `from $${treatment.priceFrom} at clinics near you.${slide.body ? " " + clean(slide.body) : ""}`
      : clean(slide.body);

  return (
    <div className="fixed inset-0 z-[100] bg-cream md:bg-cream md:grid md:place-items-center">
      <div
        className="relative w-full h-full md:w-[420px] md:h-[860px] md:rounded-[36px] md:overflow-hidden md:shadow-2xl bg-cream select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* full-bleed media + scrim */}
        <div className={`absolute inset-0 ${toneBase(slide.media_overlay)}`} aria-hidden />
        {slide.resolvedMedia && (
          <img
            src={slide.resolvedMedia}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden
          />
        )}
        {slide.resolvedMedia && (
          <div className={`absolute inset-0 ${toneClass(slide.media_overlay)}`} aria-hidden />
        )}

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
          <X className="size-5 text-ink" />
        </button>

        {/* content */}
        <div className="relative z-10 h-full flex flex-col px-6 pt-16 pb-10 text-ink">
          <p className="brand-eyebrow lowercase tracking-[0.18em] text-[11px]">
            {slide.slide_type.replace(/_/g, " ")}
          </p>

          {slide.slide_type === "results" ? (
            <ResultsSlide
              items={beforeAfters}
              onInteract={() => setPaused(true)}
              onRelease={() => setPaused(false)}
            />
          ) : slide.slide_type === "cta" ? (
            <CtaSlide
              headline={clean(slide.headline)}
              body={clean(bodyText)}
              onFindProviders={() => { onClose(); navigate({ to: "/treatments" }); }}
              onScanFirst={() => { onClose(); navigate({ to: "/scan" }); }}
            />
          ) : (
            <div className="mt-6 flex-1 flex flex-col">
              <h2
                className="text-[40px] leading-[1.02] tracking-tight lowercase font-bold"
                style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
              >
                {clean(slide.headline)}
              </h2>
              {bodyText && (
                <p className="mt-4 text-[15px] leading-snug lowercase max-w-[92%] line-clamp-4">
                  {bodyText}
                </p>
              )}
              {slide.detail_chips && slide.detail_chips.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {slide.detail_chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-ink/10 backdrop-blur px-3 py-1 text-[11px] font-semibold lowercase"
                    >
                      {clean(c)}
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

  if (!item) return null;

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
        onPointerMove={(e) => { if (e.buttons === 1) handleMove(e.clientX); }}
        onPointerUp={(e) => { e.stopPropagation(); onRelease(); }}
        onPointerCancel={onRelease}
      >
        <img src={item.after_url} alt="after" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img
            src={item.before_url}
            alt="before"
            className="absolute inset-0 h-full object-cover"
            style={{ width: `${(100 / Math.max(pos, 1)) * 100}%`, maxWidth: "none" }}
          />
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
        {(item.caption ?? "").replace(/—/g, ",")}
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
  headline,
  body,
  onFindProviders,
  onScanFirst,
}: {
  headline: string;
  body: string;
  onFindProviders: () => void;
  onScanFirst: () => void;
}) {
  return (
    <div className="mt-6 flex-1 flex flex-col">
      <h2
        className="text-[44px] leading-[1.02] tracking-tight lowercase font-bold"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
      >
        {headline || "ready when you are."}
      </h2>
      <p className="mt-3 text-[15px] lowercase text-ink">
        {body || "providers near you offer this."}
      </p>
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

// Silence unused-import warnings if any tree-shaker complains about Treatment type.
export type { Treatment };
