import { supabase } from "@/integrations/supabase/client";

export interface Recommendation {
  slug: string;
  name: string;
  category: string;
  price_from: number;
  hero_image_url: string | null;
  matchedConcerns: string[];
  score: number;
}

export interface Recommendations {
  scanDriven: Recommendation[];
  goalDriven: Recommendation[];
}

const SELECT = "slug, name, category, price_from, hero_image_url, improves, sort_order";

interface Row {
  slug: string;
  name: string;
  category: string;
  price_from: number;
  hero_image_url: string | null;
  improves: string[];
  sort_order: number;
}

/** weight: #1 concern = 3, #2 = 2, rest = 1 */
function weightOf(index: number): number {
  if (index === 0) return 3;
  if (index === 1) return 2;
  return 1;
}

function rank(rows: Row[], keys: string[], limit: number): Recommendation[] {
  return rows
    .map((r) => {
      const improves = r.improves ?? [];
      const matchedConcerns = keys.filter((k) => improves.includes(k));
      const score = matchedConcerns.reduce(
        (sum, k) => sum + weightOf(keys.indexOf(k)),
        0,
      );
      return {
        slug: r.slug,
        name: r.name,
        category: r.category,
        price_from: Number(r.price_from),
        hero_image_url: r.hero_image_url,
        matchedConcerns,
        score,
        sort_order: r.sort_order,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.sort_order - b.sort_order)
    .slice(0, limit)
    .map(({ sort_order: _sortOrder, ...rest }) => rest);
}

/**
 * Recommendation engine.
 * concerns: concern keys from the skin analysis, ordered by score descending.
 * goals: concern keys the user picked as goals (may be empty).
 * Never touches treatments with rec_mode = 'consult'.
 */
export async function getRecommendations(
  concerns: string[],
  goals: string[] = [],
): Promise<Recommendations> {
  const scanDriven: Recommendation[] = [];
  const goalDriven: Recommendation[] = [];

  if (concerns.length) {
    const { data, error } = await supabase
      .from("treatments")
      .select(SELECT)
      .eq("rec_mode", "scan")
      .overlaps("improves", concerns);
    if (error) throw error;
    scanDriven.push(...rank((data ?? []) as Row[], concerns, 6));
  }

  if (goals.length) {
    const { data, error } = await supabase
      .from("treatments")
      .select(SELECT)
      .eq("rec_mode", "goal")
      .overlaps("improves", goals);
    if (error) throw error;
    goalDriven.push(...rank((data ?? []) as Row[], goals, 4));
  }

  return { scanDriven, goalDriven };
}
