import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import {
  priceRangeLabel,
  realResultsQuery,
  storySlidesQuery,
  treatmentCatalogQuery,
  type CatalogTreatment,
  type StorySlideRow,
} from "@/lib/treatment-catalog";
import { directoryQuery, distanceKm, TORONTO_CENTROID } from "@/lib/search-data";
import { Avatar } from "@/components/treatme/ProviderCard";

const CREAM = "#FCFBF7";
const SLIDE_MS = 6000;

export function TreatmentStoryPlayer({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { data: catalog = [] } = useQuery(treatmentCatalogQuery);
  const { data: slidesRaw = [], isLoading: slidesLoading } = useQuery(storySlidesQuery(slug));
  const { data: media = [] } = useQuery(realResultsQuery(slug));
  const { data: directory } = useQuery(directoryQuery);

  const treatment = catalog.find((t) => t.slug === slug);
  const storyList = useMemo(() => catalog.filter((t) => t.has_story), [catalog]);

  /** the real_results slide only exists when consented photos exist. */
  const slides = useMemo(
    () => slidesRaw.filter((s) => s.kind !== "real_results" || media.length > 0),
    [slidesRaw, media.length],
  );

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIndex(0);
    setReady(false);
  }, [slug]);

  const slide = slides[index];
  const bg = slide?.image_url || treatment?.poster_url || null;

  /** hold on a dark frame until the first image decodes, never a white flash. */
  useEffect(() => {
    if (index !== 0) return;
    if (!bg) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.src = bg;
    const done = () => {
      if (!cancelled) setReady(true);
    };
    img.decode ? img.decode().then(done).catch(done) : (img.onload = done);
    return () => {
      cancelled = true;
    };
  }, [bg, index]);

  const paused = held || !ready || slides.length === 0;

  useEffect(() => {
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let start = performance.now();
    const carried = progress * SLIDE_MS;
    const tick = (now: number) => {
      const pct = Math.min(1, (carried + (now - start)) / SLIDE_MS);
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
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else navigate({ to: "/treatments" });
  }

  function siblingStory(step: number) {
    if (storyList.length === 0) return;
    const at = storyList.findIndex((t) => t.slug === slug);
    const nextSlug = storyList[(at + step + storyList.length) % storyList.length]?.slug;
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
  const startPt = useRef<{ x: number; y: number; t: number } | null>(null);
  const heldRef = useRef(false);

  function onPointerDown(e: ReactPointerEvent) {
    heldRef.current = false;
    startPt.current = { x: e.clientX, y: e.clientY, t: performance.now() };
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
      if (dx < 0) {
        if (index >= slides.length - 1) siblingStory(1);
        else setIndex((i) => i + 1);
      } else {
        if (index === 0) siblingStory(-1);
        else setIndex((i) => i - 1);
      }
      return;
    }
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = e.clientX - rect.left;
      if (relX < rect.width * 0.4) prev();
      else next();
    }
  }

  const providers = useMemo(() => {
    if (!directory) return [];
    return directory.providers.filter((p) => p.treatments.some((t) => t.treatment_slug === slug)).slice(0, 3);
  }, [directory, slug]);

  const empty = !slidesLoading && slides.length === 0;

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#111111]">
      <div
        className="relative size-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          releaseHold();
          startPt.current = null;
        }}
      >
        {bg && (
          <img src={bg} alt="" className="absolute inset-0 size-full object-cover" aria-hidden />
        )}
        {bg && <span aria-hidden className="absolute inset-0 bg-[#111111]/35" />}
        {bg && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-3/5"
            style={{ background: "linear-gradient(to bottom, rgba(17,17,17,0), rgba(17,17,17,0.85))" }}
          />
        )}

        {/* progress: one segment per real slide */}
        <div
          className="absolute inset-x-0 top-0 z-30 flex gap-1.5 px-4"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
        >
          {(slides.length ? slides : [null]).map((_, i) => (
            <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(252,251,247,0.25)" }}>
              <span
                className="block h-full"
                style={{
                  backgroundColor: CREAM,
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
          className="absolute right-4 z-40 grid size-9 place-items-center"
          style={{ top: "max(26px, calc(env(safe-area-inset-top) + 18px))", color: CREAM }}
        >
          <X className="size-6" strokeWidth={2} />
        </button>

        {empty && (
          <p className="absolute inset-0 grid place-items-center text-[14px] lowercase" style={{ color: CREAM }}>
            no story yet for this treatment.
          </p>
        )}

        {slide && (
          <div
            className="absolute inset-x-0 bottom-0 z-20 px-5 pb-24 transition-opacity duration-200"
            style={{ opacity: held ? 0 : 1 }}
          >
            {slide.kind === "downtime_cost" && treatment ? (
              <StatBlocks treatment={treatment} slide={slide} />
            ) : slide.kind === "real_results" ? (
              <RealResults slide={slide} media={media} />
            ) : slide.kind === "find_provider" ? (
              <FindProvider
                slide={slide}
                providers={providers}
                onSeeAll={() => {
                  navigate({ to: "/search", search: { q: treatment?.name ?? slug, scope: "providers" } });
                }}
              />
            ) : slide.kind === "who_its_for" ? (
              <>
                <Headline text={slide.headline} />
                <ul className="mt-3 space-y-1.5">
                  {slide.body
                    .split("\n")
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((line) => (
                      <li key={line} className="flex gap-2 text-[15px] leading-[1.5] lowercase" style={{ color: "rgba(252,251,247,0.85)" }}>
                        <span className="mt-[7px] size-[5px] shrink-0 rounded-full" style={{ backgroundColor: CREAM }} />
                        <span>{line}</span>
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <>
                <Headline text={slide.headline} />
                <Body text={slide.body} />
              </>
            )}
          </div>
        )}

        {/* persistent treatment identity */}
        {treatment && (
          <div
            className="absolute bottom-0 left-5 z-30 flex items-center gap-2"
            style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}
          >
            <span
              className="relative size-7 overflow-hidden rounded-full"
              style={{ backgroundColor: treatment.icon_url ? CREAM : `${treatment.accent_color}33` }}
            >
              {treatment.icon_url && (
                <>
                  <img src={treatment.icon_url} alt="" className="absolute inset-0 size-full object-cover" />
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{ backgroundColor: treatment.accent_color, opacity: 0.25, mixBlendMode: "multiply" }}
                  />
                </>
              )}
            </span>
            <span className="text-[13px] lowercase" style={{ color: CREAM }}>
              {treatment.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Headline({ text }: { text: string }) {
  return (
    <h1 className="line-clamp-3 text-[26px] font-semibold lowercase leading-tight" style={{ color: CREAM }}>
      {text}
    </h1>
  );
}

function Body({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p
      className="mt-3 line-clamp-5 text-[15px] leading-[1.5] lowercase"
      style={{ color: "rgba(252,251,247,0.85)" }}
    >
      {text.replace(/\n/g, " ")}
    </p>
  );
}

function StatBlocks({ treatment, slide }: { treatment: CatalogTreatment; slide: StorySlideRow }) {
  return (
    <>
      <Headline text={slide.headline} />
      <div className="mt-4 flex gap-3">
        <div className="flex-1 rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(252,251,247,0.12)" }}>
          <p className="text-[11px] lowercase" style={{ color: "rgba(252,251,247,0.7)" }}>
            downtime
          </p>
          <p className="mt-1 text-[22px] font-semibold lowercase leading-tight" style={{ color: CREAM }}>
            {treatment.downtime_label}
          </p>
        </div>
        <div className="flex-1 rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(252,251,247,0.12)" }}>
          <p className="text-[11px] lowercase" style={{ color: "rgba(252,251,247,0.7)" }}>
            typical range
          </p>
          <p className="mt-1 text-[22px] font-semibold lowercase leading-tight" style={{ color: CREAM }}>
            {priceRangeLabel(treatment)}
          </p>
        </div>
      </div>
      <Body text={slide.body} />
    </>
  );
}

function RealResults({
  slide,
  media,
}: {
  slide: StorySlideRow;
  media: Array<{ id: string; before_url: string; after_url: string; weeks: number | null }>;
}) {
  const item = media[0];
  if (!item) return null;
  return (
    <>
      <Headline text={slide.headline} />
      <div className="mt-4 flex gap-3">
        {(
          [
            { label: "before", url: item.before_url },
            { label: "after", url: item.after_url },
          ] as const
        ).map((side) => (
          <div key={side.label} className="flex-1">
            <img
              src={side.url}
              alt={side.label}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-2xl object-cover"
            />
            <p className="mt-1.5 text-[11px] lowercase" style={{ color: "rgba(252,251,247,0.7)" }}>
              {side.label}
              {side.label === "after" && item.weeks ? ` · ${item.weeks} weeks later` : ""}
            </p>
          </div>
        ))}
      </div>
      <Body text={slide.body} />
    </>
  );
}

function FindProvider({
  slide,
  providers,
  onSeeAll,
}: {
  slide: StorySlideRow;
  providers: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    storefronts: Array<{ name: string; lat: number; lng: number }>;
  }>;
  onSeeAll: () => void;
}) {
  return (
    <>
      <Headline text={slide.headline || "ready when you are"} />
      <Body text={slide.body} />
      {providers.length > 0 && (
        <div className="mt-4 -mx-5 flex gap-2.5 overflow-x-auto px-5 no-scrollbar">
          {providers.map((p) => (
            <div
              key={p.id}
              className="w-[150px] shrink-0 rounded-2xl px-3 py-3"
              style={{ backgroundColor: "rgba(252,251,247,0.12)" }}
            >
              <Avatar name={p.name} url={p.avatar_url} size="size-10" />
              <p className="mt-2 truncate text-[13px] font-semibold lowercase" style={{ color: CREAM }}>
                {p.name}
              </p>
              {p.storefronts[0] && (
                <p className="mt-1 truncate text-[11px] lowercase" style={{ color: "rgba(252,251,247,0.7)" }}>
                  at {p.storefronts[0].name}
                </p>
              )}
              <span className="sr-only">
                {distanceKm(TORONTO_CENTROID, {
                  lat: p.storefronts[0]?.lat ?? TORONTO_CENTROID.lat,
                  lng: p.storefronts[0]?.lng ?? TORONTO_CENTROID.lng,
                }).toFixed(0)}
                km away
              </span>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={onSeeAll}
        className="mt-5 h-13 w-full rounded-pill py-4 text-[16px] font-semibold lowercase"
        style={{ backgroundColor: "#FF1F87", color: CREAM }}
      >
        see all providers
      </button>
    </>
  );
}
