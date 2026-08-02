/**
 * brand-safe display labels for treatment content.
 *
 * the treatments table is the source of truth for treatment content and is
 * never written to from the app. some seeded names carry product brand names
 * ("neuromodulator (botox / dysport)"), and brand names must never appear in
 * the interface. these helpers sanitise names and categories at the
 * presentation layer only.
 */

/** generic names for entries whose seeded name is itself a brand. */
const NAME_BY_SLUG: Record<string, string> = {
  botox: "neuromodulators",
  hydrafacial: "hydradermabrasion facial",
  emsculpt: "muscle toning & fat reduction",
  coolsculpting: "cryolipolysis fat reduction",
};

/** category labels that need a generic replacement. */
const CATEGORY_BY_SLUG: Record<string, string> = {
  botox: "neuromodulators",
};

const BRAND_WORDS =
  /\b(botox|dysport|xeomin|nuceiva|juvederm|juvéderm|restylane|teosyal|profhilo|volite|sculptra|radiesse|kybella|belkyra|morpheus\s*8|morpheus8|hydrafacial|coolsculpting|emsculpt(?:\s*neo)?|ultherapy|sofwave|thermage|fraxel|picosure|clear\s*\+\s*brilliant)\b/gi;

/** removes bracketed brand lists and any stray brand word. */
function stripBrands(value: string): string {
  return value
    .replace(/\s*[([][^)\]]*[)\]]/g, (match) => (BRAND_WORDS.test(match) ? "" : match))
    .replace(BRAND_WORDS, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[/·,-]\s*$/, "")
    .trim();
}

export function displayTreatmentName(name: string, slug?: string): string {
  if (slug && NAME_BY_SLUG[slug]) return NAME_BY_SLUG[slug];
  const cleaned = stripBrands(name ?? "");
  return cleaned || (slug ? slug.replace(/-/g, " ") : "");
}

export function displayTreatmentCategory(category: string | null | undefined, slug?: string): string {
  if (slug && CATEGORY_BY_SLUG[slug]) return CATEGORY_BY_SLUG[slug];
  return stripBrands(category ?? "");
}
