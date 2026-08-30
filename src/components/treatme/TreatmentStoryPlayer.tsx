import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, Lock, MessageCircle, Sparkles, User, X } from "lucide-react";

import { realResultsQuery, treatmentCatalogQuery } from "@/lib/treatment-catalog";
import { buildSlides, storySourceQuery, INK, type StorySlide } from "@/lib/treatment-story";
import { SaveTreatmentButton } from "@/components/treatme/SaveTreatmentButton";


const SLIDE_MS = 6000;

/** a darker tint of the slide background, never a different hue. */
const darker = (bg: string, pct: number) => `color-mix(in srgb, ${bg} ${100 - pct}%, ${INK})`;
/** a lighter tint of the slide background. */
const lighter = (bg: string, pct: number) => `color-mix(in srgb, ${bg} ${100 - pct}%, #FFFFFF)`;

export function TreatmentStoryPlayer({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { data: catalog = [] } = useQuery(treatmentCatalogQuery);
  const { data: source, isLoading } = useQuery(storySourceQuery(slug));
  const { data: media = [] } = useQuery(realResultsQuery(slug));

  const slides = useMemo(() => (source ? buildSlides(source, media) : []), [source, media]);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [authPaused, setAuthPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [slug]);

  useEffect(() => {
    setProgress(0);
  }, [index]);

  const slide = slides[index];
  const bg = slide?.bg ?? "#FCFBF7";
  const paused = held || authPaused || slides.length === 0;


  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const pct = Math.min(1, (now - start) / SLIDE_MS);
      setProgress(pct);
      if (pct >= 1) {
        next();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, index, slides.length]);

  function close() {
    navigate({ to: "/treatments" });
  }

  function siblingStory(step: number) {
    if (catalog.length === 0) return;
    const at = catalog.findIndex((t) => t.slug === slug);
    const nextSlug = catalog[(at + step + catalog.length) % catalog.length]?.slug;
    if (nextSlug) navigate({ to: "/treatment/$slug/story", params: { slug: nextSlug } });
  }

  function next() {
    if (index >= slides.length - 1) siblingStory(1);
    else setIndex((i) => i + 1);
  }
  function prev() {
    if (index === 0) siblingStory(-1);
    else setIndex((i) => i - 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length]);

  const holdTimer = useRef<number | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const heldRef = useRef(false);

  function onPointerDown(e: ReactPointerEvent) {
    heldRef.current = false;
    startPt.current = { x: e.clientX, y: e.clientY };
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      setHeld(true);
    }, 220);
  }
  function releaseHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (heldRef.current) {
      heldRef.current = false;
      setHeld(false);
      return true;
    }
    return false;
  }
  function onPointerUp(e: ReactPointerEvent) {
    const start = startPt.current;
    startPt.current = null;
    const wasHeld = releaseHold();
    if (wasHeld || !start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      close();
      return;
    }
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
      return;
    }
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.4) prev();
      else next();
    }
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden" style={{ backgroundColor: bg }}>
      <div
        className="relative size-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          releaseHold();
          startPt.current = null;
        }}
      >
        {/* one segment per rendered slide */}
        <div
          className="absolute inset-x-0 top-0 z-30 flex gap-1.5 px-4"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
        >
          {(slides.length ? slides : [null]).map((s, i) => (
            <span
              key={s ? s.key : i}
              className="h-[3px] flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: "rgba(17,17,17,0.2)" }}
            >
              <span
                className="block h-full"
                style={{
                  backgroundColor: INK,
                  width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                }}
              />
            </span>
          ))}
        </div>

        <span
          className="absolute left-4 z-40"
          style={{ top: "max(26px, calc(env(safe-area-inset-top) + 18px))" }}
        >
          <SaveTreatmentButton
            slug={slug}
            name={source?.name}
            className="size-10"
            bg={darker(bg, 12)}
            onPause={() => setAuthPaused(true)}
            onResume={() => setAuthPaused(false)}
          />
        </span>


        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={close}
          aria-label="close"
          className="absolute right-4 z-40 grid size-10 place-items-center rounded-full"
          style={{
            top: "max(26px, calc(env(safe-area-inset-top) + 18px))",
            backgroundColor: darker(bg, 12),
            color: INK,
          }}
        >
          <X className="size-5" strokeWidth={2} />
        </button>


        {isLoading && <span className="sr-only">loading story</span>}
        {!isLoading && !source && (
          <p className="absolute inset-0 grid place-items-center text-[14px] lowercase" style={{ color: INK }}>
            no story here.
          </p>
        )}

        {slide && (
          <div
            className="absolute inset-x-0 bottom-0 top-[42%] z-20 px-6 pb-10 transition-opacity duration-200"
            style={{ opacity: held ? 0.35 : 1, color: INK }}
          >
            <SlideBody
              slide={slide}
              onFind={() => navigate({ to: "/search", search: { q: undefined, scope: "medspas", treatment: slug } })}
              onScan={() => navigate({ to: "/scan" })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ bg, label, icon }: { bg: string; label: string; icon: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-pill px-3.5 py-2 text-[12px] font-bold lowercase"
      style={{ backgroundColor: darker(bg, 10), letterSpacing: "0.12em" }}
    >
      {icon}
      {label}
    </span>
  );
}

function Headline({ text, size }: { text: string; size: 40 | 44 }) {
  return (
    <h1
      className="mt-4 font-medium lowercase"
      style={{ fontSize: `${size}px`, lineHeight: 1.05, letterSpacing: "-0.03em" }}
    >
      {text}
    </h1>
  );
}

function Body({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mt-4 max-w-[80%] text-[18px] lowercase" style={{ lineHeight: 1.6 }}>
      {text}
    </p>
  );
}

function SlideBody({
  slide,
  onFind,
  onScan,
}: {
  slide: StorySlide;
  onFind: () => void;
  onScan: () => void;
}) {
  const bg = slide.bg;

  if (slide.kind === "what_it_is") {
    return (
      <>
        <Chip bg={bg} label={slide.chip} icon={<Sparkles className="size-3.5" />} />
        <Headline text={`${slide.name}.`} size={44} />
        <Body text={slide.body} />
      </>
    );
  }

  if (slide.kind === "who_its_for") {
    return (
      <>
        <Chip bg={bg} label={slide.chip} icon={<User className="size-3.5" />} />
        <Headline text="is this you?" size={40} />
        <ul className="mt-5 space-y-2.5">
          {slide.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[16px] lowercase"
              style={{ backgroundColor: lighter(bg, 55), lineHeight: 1.4 }}
            >
              <span
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: INK }}
              >
                <Check className="size-3.5" strokeWidth={3} style={{ color: bg }} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {slide.pills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {slide.pills.map((p) => (
              <span
                key={p}
                className="rounded-pill px-3 py-1.5 text-[12px] font-bold lowercase"
                style={{ backgroundColor: darker(bg, 10) }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </>
    );
  }

  if (slide.kind === "numbers") {
    return (
      <>
        <Chip bg={bg} label={slide.chip} icon={<Clock className="size-3.5" />} />
        <Headline text="the numbers." size={40} />
        <div className="mt-5 space-y-2.5">
          {slide.stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-2xl px-5 py-4"
              style={{ backgroundColor: darker(bg, 10) }}
            >
              <span className="text-[16px] lowercase">{s.label}</span>
              <span className="text-[28px] font-medium lowercase" style={{ letterSpacing: "-0.02em" }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (slide.kind === "results") {
    if (slide.pairs.length === 0) {
      return (
        <>
          <Chip bg={bg} label="real results" icon={<Lock className="size-3.5" />} />
          <Headline text="real results, coming soon." size={44} />
          <Body text="consented before and afters from real patients. nothing simulated." />
        </>
      );
    }
    return (
      <>
        <Headline text="real results." size={44} />
        <div className="mt-5 -mx-6 flex gap-3 overflow-x-auto px-6 no-scrollbar">
          {slide.pairs.map((pair) => (
            <div key={pair.id} className="w-[260px] shrink-0">
              <div className="flex gap-2">
                {[
                  { label: "before", url: pair.before_url },
                  { label: "after", url: pair.after_url },
                ].map((side) => (
                  <img
                    key={side.label}
                    src={side.url}
                    alt={side.label}
                    loading="lazy"
                    className="aspect-[3/4] w-1/2 rounded-2xl object-cover"
                  />
                ))}
              </div>
              <p className="mt-2 text-[13px] lowercase">{pair.interval}</p>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (slide.kind === "faq") {
    return (
      <>
        <Chip bg={bg} label={slide.chip} icon={<MessageCircle className="size-3.5" />} />
        <Headline text={slide.question} size={40} />
        <Body text={slide.answer} />
      </>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Chip bg={bg} label={slide.chip} icon={null} />
      <Headline text="book now." size={40} />
      <Body text="clinics and providers near you offer this." />
      <div className="mt-auto">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={onFind}
          className="w-full rounded-pill py-4 text-[17px] font-semibold lowercase"
          style={{ backgroundColor: INK, color: "#FCFBF7" }}
        >
          find providers
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={onScan}
          className="mt-3.5 w-full text-center text-[15px] lowercase underline"
        >
          scan first
        </button>
      </div>
    </div>
  );
}
