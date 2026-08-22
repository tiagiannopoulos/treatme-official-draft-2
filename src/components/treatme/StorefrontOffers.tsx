import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { offerSignalsQuery } from "@/lib/storefront-offers";
import { noDash } from "@/lib/storefront-detail";

export interface OfferRow {
  slug: string;
  name: string;
  family: string;
  from: number | null;
  /** a url when the row came from the clinic's own website and is not verified yet. */
  listedOnSiteUrl: string | null;
}

const FAMILY_ORDER = ["injectables", "skin", "laser", "body"];
const DEFAULT_COUNT = 6;

function familyRank(family: string) {
  const i = FAMILY_ORDER.indexOf(family.toLowerCase());
  return i === -1 ? FAMILY_ORDER.length : i;
}

/**
 * what a clinic offers. six rows, the ones that matter to this patient first,
 * with the rest one tap away. never dump the whole menu on someone.
 */
export function StorefrontOffers({
  rows,
  onOpen,
}: {
  rows: OfferRow[];
  onOpen: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: signals } = useQuery(offerSignalsQuery());

  const tagged = useMemo(() => {
    // how common each family is here, so a clinic with mostly injectables leads
    // with injectables when we know nothing about the patient.
    const familyCount = new Map<string, number>();
    for (const r of rows) familyCount.set(r.family, (familyCount.get(r.family) ?? 0) + 1);

    return rows
      .map((r) => {
        const inJourney = signals?.journey.has(r.slug) ?? false;
        const concern = signals?.forConcern.get(r.slug) ?? null;
        return {
          ...r,
          tag: inJourney ? "in your journey" : concern ? `for your ${concern.toLowerCase()}` : null,
          rank: inJourney ? 0 : concern ? 1 : 2,
          familySize: familyCount.get(r.family) ?? 0,
        };
      })
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          b.familySize - a.familySize ||
          familyRank(a.family) - familyRank(b.family) ||
          a.name.localeCompare(b.name),
      );
  }, [rows, signals]);

  const families = useMemo(() => {
    const groups = new Map<string, typeof tagged>();
    for (const t of tagged) {
      const list = groups.get(t.family) ?? [];
      list.push(t);
      groups.set(t.family, list);
    }
    return [...groups.entries()].sort(
      (a, b) => familyRank(a[0]) - familyRank(b[0]) || a[0].localeCompare(b[0]),
    );
  }, [tagged]);

  if (rows.length === 0) return null;

  const shown = tagged.slice(0, DEFAULT_COUNT);
  const evidence = rows.find((r) => r.listedOnSiteUrl)?.listedOnSiteUrl ?? null;
  const anyUnverified = rows.some((r) => r.listedOnSiteUrl);

  return (
    <section className="px-5 pt-8">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[20px] font-medium lowercase tracking-[-0.02em]">what they offer</h2>
        <span className="text-[13px] lowercase text-ink/55">
          {rows.length} {rows.length === 1 ? "treatment" : "treatments"}
        </span>
      </div>

      {!expanded ? (
        <ul className="mt-3">
          {shown.map((t, i) => (
            <OfferLine key={t.slug} row={t} tag={t.tag} first={i === 0} onOpen={onOpen} />
          ))}
        </ul>
      ) : (
        <div>
          {families.map(([family, list]) => (
            <div key={family} className="mt-4">
              <p className="text-[12px] lowercase text-ink/55">{noDash(family)}</p>
              <ul className="mt-1">
                {list.map((t, i) => (
                  <OfferLine key={t.slug} row={t} tag={t.tag} first={i === 0} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {rows.length > DEFAULT_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-[13px] lowercase text-ink underline"
        >
          {expanded ? "show fewer" : `see all ${rows.length}`}
        </button>
      )}

      {anyUnverified && (
        <p className="mt-3 text-[11px] lowercase text-ink/45">
          listed on this clinic's website
          {evidence && (
            <>
              {" "}
              <a href={evidence} target="_blank" rel="noreferrer noopener" className="underline">
                see the page
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}

function OfferLine({
  row,
  tag,
  first,
  onOpen,
}: {
  row: OfferRow;
  tag: string | null;
  first: boolean;
  onOpen: (slug: string) => void;
}) {
  return (
    <li style={{ borderTop: first ? "none" : "1px solid rgba(17,17,17,0.08)" }}>
      <button
        type="button"
        onClick={() => onOpen(row.slug)}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] lowercase">{noDash(row.name)}</span>
          {tag && (
            <span className="mt-1 inline-block rounded-pill bg-mint px-2 py-0.5 text-[11px] lowercase">
              {noDash(tag)}
            </span>
          )}
        </span>
        {row.from !== null && (
          <span className="shrink-0 text-[13px] lowercase text-ink/60">from ${Math.round(row.from)}</span>
        )}
        <ChevronRight className="size-4 shrink-0 text-ink/30" />
      </button>
    </li>
  );
}
