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

  const { data, error } = await supabase
    .from("concern_treatments")
    .select("concern_key, treatment_slug, strength, treatments!inner(slug, name, price_from)")
    .in("concern_key", labels);

  if (error || !data) {
    console.warn("concern treatments read failed", error?.message);
    return [];
  }

  const best = new Map<string, ConcernMatch>();

  for (const row of data as unknown as {
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

  return [...best.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name)).slice(0, limit);
}
