import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  Droplet,
  Lightbulb,
  List,
  Quote,
  Ruler,
  Shield,
  Sparkles,
  X,
} from "lucide-react";

import { eduSlidesQuery, eduStoriesQuery, type EduSlide } from "@/lib/education-story";
import { INK } from "@/lib/treatment-story";

const SLIDE_MS = 6000;

const darker = (bg: string, pct: number) => `color-mix(in srgb, ${bg} ${100 - pct}%, ${INK})`;
const lighter = (bg: string, pct: number) => `color-mix(in srgb, ${bg} ${100 - pct}%, #FFFFFF)`;

export const Route = createFileRoute("/learn/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ");
    const title = `${pretty} · treatme learn`;
    const description = `a short walkthrough of ${pretty}, in plain language, before you book anything.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <p className="brand-eyebrow">something broke</p>
      <h1 className="brand-display text-[24px] mt-2">couldn't load this story.</h1>
      <p className="mt-2 text-[13px] text-ink-mute">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10 lowercase">no story here.</div>,
  component: LearnStory,
});

function icon(name: string | null) {
  const cls = "size-3.5";
  switch (name) {
    case "sparkles": return <Sparkles className={cls} />;
    case "book": return <BookOpen className={cls} />;
    case "ruler": return <Ruler className={cls} />;
    case "quote": return <Quote className={cls} />;
    case "alert": return <AlertTriangle className={cls} />;
    case "shield": return <Shield className={cls} />;
    case "bulb": return <Lightbulb className={cls} />;
    case "clock": return <Clock className={cls} />;
    case "list": return <List className={cls} />;
    case "droplet": return <Droplet className={cls} />;
    default: return null;
  }
}

function LearnStory() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: stories = [] } = useQuery(eduStoriesQuery);
  const { data: slides = [], isLoading } = useQuery(eduSlidesQuery(slug));

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => setIndex(0), [slug]);
  useEffect(() => setProgress(0), [index]);

  const slide = slides[index];
  const bg = slide?.bg ?? "#FCFBF7";
  const paused = held || slides.length === 0;

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
    navigate({ to: "/" });
  }

  function sibling(step: number) {
    if (stories.length === 0) {
      close();
      return;
    }
    const at = stories.findIndex((s) => s.slug === slug);
    const nextSlug = stories[(at + step + stories.length) % stories.length]?.slug;
    if (nextSlug && nextSlug !== slug) navigate({ to: "/learn/$slug", params: { slug: nextSlug } });
    else close();
  }

  function next() {
    if (index >= slides.length - 1) sibling(1);
    else setIndex((i) => i + 1);
  }
  function prev() {
    if (index === 0) sibling(-1);
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
        <div
          className="absolute inset-x-0 top-0 z-30 flex gap-1.5 px-4"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
        >
          {(slides.length ? slides : [null]).map((s, i) => (
            <span
              key={s ? s.id : i}
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
        {!isLoading && slides.length === 0 && (
          <p className="absolute inset-0 grid place-items-center text-[14px] lowercase" style={{ color: INK }}>
            no story here.
          </p>
        )}

        {slide && (
          <div
            className="absolute inset-x-0 bottom-0 top-[36%] z-20 px-6 pb-10 transition-opacity duration-200"
            style={{ opacity: held ? 0.35 : 1, color: INK }}
          >
            <SlideBody slide={slide} onCta={(route) => navigate({ to: route as never })} />
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ bg, label, iconName }: { bg: string; label: string; iconName: string | null }) {
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-pill px-3.5 py-2 text-[12px] font-bold lowercase"
      style={{ backgroundColor: darker(bg, 10), letterSpacing: "0.12em" }}
    >
      {icon(iconName)}
      {label}
    </span>
  );
}

function Headline({ text, size }: { text: string; size: number }) {
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
    <p className="mt-4 max-w-[88%] text-[17px] lowercase" style={{ lineHeight: 1.55 }}>
      {text}
    </p>
  );
}

function withPeriod(text: string) {
  if (!text) return text;
  return /[.?]$/.test(text) ? text : `${text}.`;
}

function SlideBody({ slide, onCta }: { slide: EduSlide; onCta: (route: string) => void }) {
  const bg = slide.bg;

  if (slide.kind === "checklist") {
    return (
      <>
        <Chip bg={bg} label={slide.chip_label} iconName={slide.chip_icon} />
        <Headline text={withPeriod(slide.headline)} size={34} />
        <ul className="mt-5 space-y-2.5">
          {slide.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-2xl px-4 py-3 text-[15px] lowercase"
              style={{ backgroundColor: lighter(bg, 55), lineHeight: 1.4 }}
            >
              <span
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: INK }}
              >
                <Check className="size-3.5" strokeWidth={3} style={{ color: "#FFFFFF" }} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (slide.kind === "pills") {
    return (
      <>
        <Chip bg={bg} label={slide.chip_label} iconName={slide.chip_icon} />
        <Headline text={withPeriod(slide.headline)} size={36} />
        <div className="mt-5 flex flex-wrap gap-2">
          {slide.pills.map((p) => (
            <span
              key={p}
              className="rounded-pill px-3.5 py-2 text-[13px] font-bold lowercase"
              style={{ backgroundColor: darker(bg, 12) }}
            >
              {p}
            </span>
          ))}
        </div>
        <Body text={slide.body} />
      </>
    );
  }

  if (slide.kind === "quote") {
    return (
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-2 select-none font-medium"
          style={{ fontSize: "180px", lineHeight: 1, color: "rgba(17,17,17,0.08)" }}
        >
          {"\u201C"}
        </span>
        <div className="relative">
          <Chip bg={bg} label={slide.chip_label} iconName={slide.chip_icon} />
          <Headline text={withPeriod(slide.headline)} size={40} />
        </div>
      </div>
    );
  }

  if (slide.kind === "cta") {
    return (
      <div className="flex h-full flex-col">
        <Chip bg={bg} label={slide.chip_label} iconName={slide.chip_icon} />
        <Headline text={withPeriod(slide.headline)} size={36} />
        <Body text={slide.body} />
        <div className="mt-auto">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => onCta(slide.cta_route)}
            className="w-full rounded-pill py-4 text-[17px] font-semibold lowercase"
            style={{ backgroundColor: INK, color: "#FCFBF7" }}
          >
            {slide.cta_label || "keep going"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Chip bg={bg} label={slide.chip_label} iconName={slide.chip_icon} />
      <Headline text={withPeriod(slide.headline)} size={36} />
      <Body text={slide.body} />
    </>
  );
}
