import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { SCAN_CONCERN_LABEL, type ScanConcernRow } from "@/lib/scan-concerns";

export interface ConcernMatch {
  slug: string;
  name: string;
  /** the concern this treatment is here for, in ui words */
  concernLabel: string;
  priceFrom: number | null;
  weight: number;
}

/** weight for the nth worst concern: #1 = 3, #2 = 2, rest = 1 */
function concernWeight(index: number) {
  if (index === 0) return 3;
  if (index === 1) return 2;
  return 1;
}

interface TreatmentRow {
  slug: string;
  name: string;
  short_description: string | null;
  price_from: number | null;
  downtime: string | null;
  family: string | null;
  improves: string[] | null;
  search_synonyms: string[] | null;
  sort_order: number | null;
}

const TREATMENT_COLUMNS =
  "slug, name, short_description, price_from, downtime, family, improves, search_synonyms, sort_order";

let cache: TreatmentRow[] | null = null;

/** the whole catalogue, read once, so the fallbacks cost nothing extra. */
async function allTreatments(): Promise<TreatmentRow[]> {
  if (cache) return cache;
  const { data, error } = await supabase.from("treatments").select(TREATMENT_COLUMNS);
  if (error || !data) {
    console.warn("treatment catalogue read failed", error?.message);
    return [];
  }
  cache = data as unknown as TreatmentRow[];
  return cache;
}

/**
 * top treatments for this scan, read from concern_treatments joined to
 * treatments and ranked by how strongly they address the lowest scores.
 */
export async function treatmentsForConcerns(
  rows: ScanConcernRow[],
  limit = 5,
): Promise<ConcernMatch[]> {
  const ordered = [...rows].sort((a, b) => a.score - b.score).slice(0, 6);
  const labels = ordered.map((r) => SCAN_CONCERN_LABEL[r.concern_key] ?? r.concern_key);
  if (!labels.length) return [];

  const { data } = await supabase
    .from("concern_treatments")
    .select("concern_key, treatment_slug, strength, treatments!inner(slug, name, price_from)")
    .in("concern_key", labels);

  const best = new Map<string, ConcernMatch>();

  for (const row of (data ?? []) as unknown as {
    concern_key: string;
    treatment_slug: string;
    strength: number | null;
    treatments: { slug: string; name: string; price_from: number | null } | null;
  }[]) {
    const t = row.treatments;
    if (!t) continue;
    const idx = labels.indexOf(row.concern_key);
    const weight = (row.strength ?? 1) * concernWeight(idx < 0 ? labels.length : idx);
    const existing = best.get(t.slug);
    if (existing && existing.weight >= weight) continue;
    best.set(t.slug, {
      slug: t.slug,
      name: displayTreatmentName(t.name, t.slug),
      concernLabel: row.concern_key,
      priceFrom: t.price_from === null ? null : Number(t.price_from),
      weight,
    });
  }

  const ranked = [...best.values()].sort(
    (a, b) => b.weight - a.weight || a.name.localeCompare(b.name),
  );

  // never hand back an empty or thin list: fall back through the top concern.
  if (ranked.length < 4 && labels[0]) {
    const fallback = await treatmentsForOneConcern(labels[0]);
    for (const t of fallback) {
      if (ranked.length >= limit) break;
      if (ranked.some((r) => r.slug === t.slug)) continue;
      ranked.push({
        slug: t.slug,
        name: t.name,
        concernLabel: labels[0],
        priceFrom: t.priceFrom,
        weight: 0,
      });
    }
  }

  return ranked.slice(0, limit);
}

export interface ConcernTreatment {
  slug: string;
  name: string;
  shortDescription: string | null;
  priceFrom: number | null;
  downtime: string | null;
  strength: number;
}

function toConcernTreatment(t: TreatmentRow, strength: number): ConcernTreatment {
  return {
    slug: t.slug,
    name: displayTreatmentName(t.name, t.slug),
    shortDescription: t.short_description,
    priceFrom: t.price_from === null ? null : Number(t.price_from),
    downtime: t.downtime,
    strength,
  };
}

function matchesConcern(values: string[] | null, concern: string): boolean {
  const needle = concern.toLowerCase();
  return (values ?? []).some((v) => {
    const hay = v.toLowerCase();
    return hay.includes(needle) || needle.includes(hay);
  });
}

/**
 * treatments for one concern. a list here is never empty: we cascade through
 * the mapping table, the improves array, search synonyms, the same family and
 * finally the highest sort_order until we have at least four.
 */
export async function treatmentsForOneConcern(
  concernLabel: string,
  min = 4,
  max = 5,
): Promise<ConcernTreatment[]> {
  const catalogue = await allTreatments();
  const bySlug = new Map(catalogue.map((t) => [t.slug, t]));

  const out: ConcernTreatment[] = [];
  const seen = new Set<string>();
  const push = (t: TreatmentRow | undefined, strength: number) => {
    if (!t || seen.has(t.slug) || out.length >= max) return;
    seen.add(t.slug);
    out.push(toConcernTreatment(t, strength));
  };

  // 1. the explicit mapping
  const { data: mapped } = await supabase
    .from("concern_treatments")
    .select("strength, treatment_slug")
    .eq("concern_key", concernLabel);

  const mappedRows = ((mapped ?? []) as { strength: number | null; treatment_slug: string }[])
    .map((r) => ({ row: bySlug.get(r.treatment_slug), strength: r.strength ?? 1 }))
    .filter((r) => Boolean(r.row))
    .sort(
      (a, b) =>
        b.strength - a.strength ||
        (a.row!.price_from ?? Number.MAX_SAFE_INTEGER) - (b.row!.price_from ?? Number.MAX_SAFE_INTEGER),
    );
  for (const r of mappedRows) push(r.row, r.strength);

  // 2. treatments whose improves array overlaps the concern
  if (out.length < min) {
    for (const t of catalogue.filter((t) => matchesConcern(t.improves, concernLabel))) push(t, 1);
  }

  // 3. search synonym match
  if (out.length < min) {
    for (const t of catalogue.filter((t) => matchesConcern(t.search_synonyms, concernLabel))) push(t, 1);
  }

  // 4. same family as whatever we already have
  if (out.length < min) {
    const families = new Set(
      out.map((t) => bySlug.get(t.slug)?.family).filter((f): f is string => Boolean(f)),
    );
    for (const t of catalogue.filter((t) => t.family && families.has(t.family))) push(t, 0);
  }

  // 5. highest sort_order
  if (out.length < min) {
    const byOrder = [...catalogue].sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0));
    for (const t of byOrder) push(t, 0);
  }

  return out.slice(0, max);
}
