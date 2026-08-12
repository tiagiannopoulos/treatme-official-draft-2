import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Info, Search, Sparkles, X, ChevronRight, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { CATEGORY_PILLS, pillFor, treatmentCatalogQuery, type CategoryPill } from "@/lib/treatment-catalog";
import { displayTreatmentCategory, displayTreatmentName } from "@/lib/treatment-labels";

import { CONCERN_LABEL, type ConcernKey } from "@/lib/skinAnalysis";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/treatments/")({
  head: () => ({
    meta: [
      { title: "treatment library · treatme" },
      { name: "description", content: "every treatment we cover, grouped by family. search by name or the brand name you know it by." },
      { property: "og:title", content: "treatment library · treatme" },
      { property: "og:description", content: "every treatment we cover, grouped by family. search by name or the brand name you know it by." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(libraryQuery);
    context.queryClient.ensureQueryData(treatmentCatalogQuery);
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <p className="brand-eyebrow">something broke</p>
      <h1 className="brand-display text-[28px] mt-2">couldn't load the library.</h1>
      <p className="text-[13px] text-ink-mute mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10">no treatments found.</div>,
  component: TreatmentsPage,
});

/** display order for families */
const FAMILY_ORDER = [
  "injectables",
  "skin & facials",
  "resurfacing",
  "laser & light",
  "tightening & lifting",
  "body",
  "hair & regenerative",
  "wellness",
] as const;

interface LibraryRow {
  slug: string;
  name: string;
  category: string;
  family: string;
  aliases: string[];
  improves: string[];
  price_from: number;
  hero_image_url: string | null;
  hero_image: string;
  sort_order: number;
}

const sel = (s: string): string => s;

const libraryQuery = queryOptions({
  queryKey: ["treatment-library"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("treatments")
      .select(
        sel("slug, name, category, family, aliases, improves, price_from, hero_image_url, hero_image, sort_order"),
      )
      .order("sort_order", { ascending: true })
      .returns<LibraryRow[]>();
    if (error) throw error;
    return (data ?? []).map((t) => ({
      ...t,
      name: displayTreatmentName(t.name, t.slug),
      category: displayTreatmentCategory(t.category, t.slug),
    }));
  },
  staleTime: 5 * 60_000,
});


function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const PREVIEW_COUNT = 2;

function TreatmentsPage() {
  const { data: treatments } = useSuspenseQuery(libraryQuery);
  const { data: catalog } = useSuspenseQuery(treatmentCatalogQuery);
  const catalogBySlug = useMemo(() => new Map(catalog.map((c) => [c.slug, c])), [catalog]);
  const [pill, setPill] = useState<CategoryPill>("all");
  const [q, setQ] = useState("");
  const [concern, setConcern] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleFamily = (family: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  const concerns = useMemo(() => {
    const set = new Set<string>();
    treatments.forEach((t) => (t.improves ?? []).forEach((c) => set.add(c)));
    return [...set].sort((a, b) => label(a).localeCompare(label(b)));
  }, [treatments]);

  const results = useMemo(() => {
    const needle = norm(q);
    return treatments
      .map((t) => {
        if (pill !== "all" && pillFor(t.family) !== pill) return null;
        if (concern && !(t.improves ?? []).includes(concern)) return null;
        if (!needle) return { t, alias: null as string | null };
        if (norm(t.name).includes(needle) || norm(t.category).includes(needle)) {
          return { t, alias: null as string | null };
        }
        const alias = (t.aliases ?? []).find((a) => norm(a).includes(needle));
        return alias ? { t, alias } : null;
      })
      .filter((r): r is { t: LibraryRow; alias: string | null } => r !== null);
  }, [treatments, q, concern, pill]);

  const grouped = useMemo(() => {
    const order = (f: string) => {
      const i = FAMILY_ORDER.indexOf(f as (typeof FAMILY_ORDER)[number]);
      return i === -1 ? FAMILY_ORDER.length : i;
    };
    const map = new Map<string, typeof results>();
    results.forEach((r) => {
      const list = map.get(r.t.family) ?? [];
      list.push(r);
      map.set(r.t.family, list);
    });
    return [...map.entries()]
      .sort((a, b) => order(a[0]) - order(b[0]))
      .map(([family, items]) => ({
        family,
        items: [...items].sort((a, b) => a.t.sort_order - b.t.sort_order),
      }));
  }, [results]);

  const searching = q.trim().length > 0 || concern !== null;

  return (
    <div className="px-6 pt-6 pb-8">
      {/* search */}
      <div className="mt-5 relative">
        <Search className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search treatments, or the brand name you know"
          className="w-full h-12 rounded-full bg-card border border-line pl-11 pr-10 text-[14px] lowercase placeholder:text-ink-mute focus:outline-none focus:border-ink/40"
        />
        {q && (
          <button
            type="button"
            aria-label="clear search"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-full bg-ink/5"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* category pills */}
      <div className="mt-3 -mx-6 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 px-6 pb-1">
          {CATEGORY_PILLS.map((c) => (
            <button key={c} type="button" onClick={() => setPill(c)} className={chipCls(pill === c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* concern filter */}
      <div className="mt-3">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-2xl border border-line bg-cream px-4 h-12 text-left"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-ink" strokeWidth={2.2} />
                <span className="text-[14px] font-semibold lowercase text-ink">
                  {concern ? label(concern) : "view all concerns"}
                </span>
              </span>
              <ChevronRight className="size-4 text-ink-soft" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[24px] bg-cream px-6 pb-8 pt-4 h-[85vh]">
            <SheetHeader className="text-left pb-2">
              <SheetTitle className="brand-display text-[22px] lowercase">what's your concern?</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-6 overflow-y-auto max-h-[calc(85vh-120px)] scrollbar-none pr-1">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute mb-3">start here</p>
                <button
                  type="button"
                  onClick={() => setConcern(null)}
                  className={cn(
                    "w-full text-left rounded-2xl border px-4 h-14 text-[14px] font-semibold lowercase transition",
                    concern === null
                      ? "bg-ink text-cream border-ink"
                      : "bg-cream text-ink border-line hover:border-ink/40",
                  )}
                >
                  everything
                </button>
              </section>
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute mb-3">all concerns</p>
                <div className="grid grid-cols-2 gap-3">
                  {concerns.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setConcern(c)}
                      className={cn(
                        "text-left rounded-2xl border p-4 text-[13px] font-semibold lowercase leading-tight transition min-h-[64px] flex items-center",
                        concern === c
                          ? "bg-ink text-cream border-ink"
                          : "bg-cream text-ink border-line hover:border-ink/40",
                      )}
                    >
                      {label(c)}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {searching && (
        <p className="mt-4 text-[12px] text-ink-mute lowercase">
          {results.length} {results.length === 1 ? "match" : "matches"}
        </p>
      )}

      {grouped.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-mint p-5">
          <p className="font-bold text-[16px]">nothing matched that.</p>
          <p className="text-[13px] text-ink/75 mt-1">try a shorter word, or clear the filters.</p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setConcern(null);
            }}
            className="mt-3 text-[13px] font-bold lowercase underline"
          >
            reset
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {grouped.map(({ family, items }) => {
            const isExpanded = expanded.has(family) || items.length <= PREVIEW_COUNT;
            const visible = isExpanded ? items : items.slice(0, PREVIEW_COUNT);
            const remaining = items.length - PREVIEW_COUNT;
            return (
              <section key={family}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="brand-display text-[22px] lowercase">{family}</h2>
                  <p className="text-[11px] text-ink-mute lowercase shrink-0">{items.length} treatments</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {visible.map(({ t, alias }) => (
                    <CompactCard key={t.slug} t={t} alias={alias} catalog={catalogBySlug.get(t.slug)} />
                  ))}
                </div>
                {!isExpanded && remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleFamily(family)}
                    className="mt-3 w-full h-11 rounded-full border border-line bg-cream text-[13px] font-semibold lowercase text-ink-soft hover:border-ink/40 transition"
                  >
                    show {remaining} more
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function label(key: string) {
  return CONCERN_LABEL[key as ConcernKey] ?? key.replace(/([A-Z])/g, " $1").toLowerCase();
}

function chipCls(active: boolean) {
  return cn(
    "shrink-0 rounded-full px-3 h-8 text-[12px] font-semibold lowercase border transition",
    active
      ? "bg-ink text-cream border-ink"
      : "bg-cream border-line text-ink-soft hover:border-ink/40",
  );
}

function CompactCard({
  t,
  alias,
  catalog,
}: {
  t: LibraryRow;
  alias: string | null;
  catalog?: {
    icon_url: string | null;
    accent_color: string;
    has_story: boolean;
    downtime_label: string;
    blurb: string;
    avg_price_low: number | null;
    avg_price_high: number | null;
  };
}) {
  const navigate = useNavigate();
  // tapping the card plays the story. the info link opens the full one pager.
  const meta = catalog?.blurb || catalog?.downtime_label || t.category;
  const price = t.price_from ?? catalog?.avg_price_low ?? null;
  return (
    <div className="relative flex flex-col rounded-2xl border border-line bg-cream overflow-hidden">
      <button
        type="button"
        onClick={() => navigate({ to: "/treatment/$slug/story", params: { slug: t.slug } })}
        className="flex w-full flex-col text-left active:scale-[0.98] transition-transform"
      >
        <div
          className="h-28 grid place-items-center overflow-hidden"
          style={{ background: catalog?.accent_color || "rgba(248,161,198,0.35)" }}
        >
          <Sparkles className="size-7 text-ink/40" strokeWidth={1.6} />
        </div>
        <div className="p-3">
          <p className="font-bold text-[14px] tracking-tight leading-tight lowercase">{t.name}</p>
          <p className="text-[11px] text-ink-mute mt-1 leading-snug line-clamp-2 lowercase">{meta}</p>
          <p className="text-[10px] text-ink-mute mt-1 lowercase">
            {catalog?.downtime_label || "downtime varies"}
          </p>
          {price !== null && (
            <p className="text-[11px] font-semibold mt-2" style={{ color: "#FF1F87" }}>
              from ${Math.round(price)}
            </p>
          )}
        </div>
      </button>
      <Link
        to="/treatment/$slug"
        params={{ slug: t.slug }}
        className="mx-3 mb-3 -mt-1 self-start inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold lowercase text-ink-soft"
      >
        <Info className="size-3" />
        treatment info
      </Link>
      {alias && (
        <span className="absolute left-2 right-2 top-2 truncate rounded-full bg-hot px-2 py-1 text-[10px] font-bold lowercase text-white">
          matched your search
        </span>
      )}
    </div>
  );
}


