import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTreatmentStory } from "@/lib/treatment-story-store";
import { displayTreatmentCategory, displayTreatmentName } from "@/lib/treatment-labels";

import { CONCERN_LABEL, type ConcernKey } from "@/lib/skinAnalysis";
import { cn } from "@/lib/utils";

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
        if (concern && !(t.improves ?? []).includes(concern)) return null;
        if (!needle) return { t, alias: null as string | null };
        if (norm(t.name).includes(needle) || norm(t.category).includes(needle)) {
          return { t, alias: null as string | null };
        }
        const alias = (t.aliases ?? []).find((a) => norm(a).includes(needle));
        return alias ? { t, alias } : null;
      })
      .filter((r): r is { t: LibraryRow; alias: string | null } => r !== null);
  }, [treatments, q, concern]);

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

      {/* concern filter chips */}
      <div className="mt-3 -mx-6 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 px-6 pb-1">
          <button
            type="button"
            onClick={() => setConcern(null)}
            className={chipCls(concern === null)}
          >
            everything
          </button>
          {concerns.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setConcern(concern === c ? null : c)}
              className={chipCls(concern === c)}
            >
              {label(c)}
            </button>
          ))}
        </div>
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
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {visible.map(({ t, alias }) => (
                    <CoverCard key={t.slug} t={t} alias={alias} />
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

/** soft brand tint so cards read intentionally before hero images land */
const TINTS = ["bg-bubblegum/35", "bg-butter/60", "bg-mint/60", "bg-ink/5"];
function tintFor(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return TINTS[h % TINTS.length];
}

function CoverCard({ t, alias }: { t: LibraryRow; alias: string | null }) {
  const { open } = useTreatmentStory();
  const src = t.hero_image_url || t.hero_image || undefined;
  return (
    <button
      type="button"
      onClick={() => open(t.slug)}
      className="text-left rounded-2xl overflow-hidden border border-line bg-cream active:scale-[0.98] transition"
    >
      <div className={cn("relative aspect-[4/5] w-full overflow-hidden", tintFor(t.slug))}>
        {src ? (
          <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center brand-display text-[40px] text-ink/25 lowercase">
            {t.name.slice(0, 2)}
          </span>
        )}
        {alias && (
          <span className="absolute top-2 left-2 right-2 rounded-full bg-hot text-white px-2 py-1 text-[10px] font-bold lowercase truncate">
            matched: {alias}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-bold text-[14px] tracking-tight leading-tight lowercase line-clamp-2">{t.name}</p>
        <p className="text-[11px] text-ink-mute mt-1 leading-snug line-clamp-2 lowercase">{t.category}</p>
        <p className="text-[11px] text-ink-soft font-semibold mt-2">from ${Math.round(Number(t.price_from))}</p>
      </div>
    </button>
  );
}
