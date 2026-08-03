import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Check,
  Clock,
  Droplet,
  Lightbulb,
  List,
  Quote as QuoteIcon,
  Ruler,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import {
  bgHex,
  educationStoriesQuery,
  educationStoryQuery,
  INK,
  type EducationSlide,
} from "@/lib/education-stories";

const SLIDE_MS = 6000;

const darker = (bg: string, pct: number) => `color-mix(in srgb, ${bg} ${100 - pct}%, ${INK})`;
const lighter = (bg: string, pct: number) => `color-mix(in srgb, ${bg} ${100 - pct}%, #FFFFFF)`;

function chipIcon(name: string | null) {
  const cls = "size-3.5";
  switch ((name ?? "").trim().toLowerCase()) {
    case "sparkles": return <Sparkles className={cls} strokeWidth={1.8} />;
    case "book": return <BookOpen className={cls} strokeWidth={1.8} />;
    case "ruler": return <Ruler className={cls} strokeWidth={1.8} />;
    case "quote": return <QuoteIcon className={cls} strokeWidth={1.8} />;
    case "alert": return <AlertCircle className={cls} strokeWidth={1.8} />;
    case "shield": return <ShieldCheck className={cls} strokeWidth={1.8} />;
    case "bulb": return <Lightbulb className={cls} strokeWidth={1.8} />;
    case "clock": return <Clock className={cls} strokeWidth={1.8} />;
    case "list": return <List className={cls} strokeWidth={1.8} />;
    case "droplet": return <Droplet className={cls} strokeWidth={1.8} />;
    default: return null;
  }
}

export function EducationStoryPlayer({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(educationStoryQuery(slug));
  const { data: stories = [] } = useQuery(educationStoriesQuery);

  const slides: EducationSlide[] = data?.slides ?? [];

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => setIndex(0), [slug]);
  useEffect(() => setProgress(0), [index]);

  const slide = slides[index];
  const bg = bgHex(slide?.bg);
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
    navigate({ to: "/treatments" });
  }

  function sibling(step: number) {
    if (stories.length === 0) {
      close();
      return;
    }
    const at = stories.findIndex((s) => s.slug === slug);
    const nextSlug = stories[(at + step + stories.length) % stories.length]?.slug;
    if (!nextSlug || nextSlug === slug) close();
    else navigate({ to: "/learn/$slug", params: { slug: nextSlug } });
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

  function go(route: string) {
    if (!route) return;
    navigate({ href: route });
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
            className="absolute inset-x-0 bottom-0 top-[42%] z-20 px-6 pb-10 transition-opacity duration-200"
            style={{ opacity: held ? 0.35 : 1, color: INK }}
          >
            <SlideBody slide={slide} onGo={go} />
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ bg, label, icon }: { bg: string; label: string; icon: React.ReactNode }) {
  if (!label) return null;
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
    <p className="mt-4 max-w-[80%] text-[18px] lowercase" style={{ lineHeight: 1.6 }}>
      {text}
    </p>
  );
}

const withPeriod = (t: string) => (t && !/[.?!]$/.test(t) ? `${t}.` : t);

function SlideBody({ slide, onGo }: { slide: EducationSlide; onGo: (route: string) => void }) {
  const bg = bgHex(slide.bg);
  const icon = chipIcon(slide.chip_icon);

  if (slide.kind === "checklist") {
    return (
      <>
        <Chip bg={bg} label={slide.chip} icon={icon} />
        <Headline text={slide.headline} size={40} />
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
        <Chip bg={bg} label={slide.chip} icon={icon} />
        <Headline text={slide.headline} size={40} />
        <div className="mt-5 flex flex-wrap gap-2">
          {slide.pills.map((p) => (
            <span
              key={p}
              className="rounded-pill px-3.5 py-2 text-[14px] font-semibold lowercase"
              style={{ backgroundColor: darker(bg, 14) }}
            >
              {p}
            </span>
          ))}
        </div>
      </>
    );
  }

  if (slide.kind === "quote") {
    return (
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-2 select-none font-medium"
          style={{ fontSize: "180px", lineHeight: 1, color: INK, opacity: 0.08 }}
        >
          “
        </span>
        <div className="relative">
          <Chip bg={bg} label={slide.chip} icon={icon} />
          <Headline text={slide.headline} size={40} />
        </div>
      </div>
    );
  }

  if (slide.kind === "cta") {
    return (
      <div className="flex h-full flex-col">
        <Chip bg={bg} label={slide.chip} icon={icon} />
        <Headline text={withPeriod(slide.headline)} size={40} />
        <Body text={slide.body} />
        <div className="mt-auto">
          {slide.cta_label && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => onGo(slide.cta_route)}
              className="w-full rounded-pill py-4 text-[17px] font-semibold lowercase"
              style={{ backgroundColor: INK, color: "#FCFBF7" }}
            >
              {slide.cta_label}
            </button>
          )}
          {slide.link_label && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => onGo("/treatments")}
              className="mt-3.5 w-full text-center text-[15px] lowercase underline"
            >
              {slide.link_label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Chip bg={bg} label={slide.chip} icon={icon} />
      <Headline text={withPeriod(slide.headline)} size={44} />
      <Body text={slide.body} />
    </>
  );
}
