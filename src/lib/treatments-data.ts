// Catalogue of treatments + seeded clinics for the MVP flow.
// Slugs are what the model is asked to recommend (see /api/analyze prompt).

export type TreatmentGroup = "injectables" | "skin" | "laser" | "body";

export type Treatment = {
  slug: string;
  name: string;
  category: string;
  group: TreatmentGroup;
  improves: string[];
  whatItIs: string;
  whatToExpect: string;
  downtime: string;
  priceFrom: number;
  // editorial hero image (unsplash), used as story hook + treatments tab cover
  heroImage: string;
  // brand scrim tone applied over the hero
  heroTone: "cream_scrim" | "butter_scrim" | "mint_scrim" | "bubblegum_scrim";
  descriptor: string; // one-line descriptor for cover cards
};

// Unsplash editorial beauty + macro texture set. Consistent look:
// dewy skin, macro texture, water, silk, cream, soft natural light.
const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

export const TREATMENTS: Treatment[] = [
  {
    slug: "hydrafacial",
    name: "hydrafacial",
    category: "deep cleansing & hydration",
    group: "skin",
    improves: ["hydration", "pores", "texture", "dullness"],
    whatItIs:
      "a medical-grade three-step facial: cleanse and exfoliate, extract debris from pores, then infuse the skin with hydrating and antioxidant serums.",
    whatToExpect:
      "45-60 minutes. you'll feel suction, then cool serums. skin reads brighter and plumper same day.",
    downtime: "none",
    priceFrom: 189,
    heroImage: IMG("1616394584738-fc6e612e71b9"),
    heroTone: "bubblegum_scrim",
    descriptor: "cleanse, exfoliate, hydrate.",
  },
  {
    slug: "botox",
    name: "neuromodulator (botox / dysport)",
    category: "fine lines & wrinkles",
    group: "injectables",
    improves: ["fineLines", "wrinkles"],
    whatItIs:
      "tiny injections that relax specific muscles creating expression lines. only a licensed provider can assess if it's right for you.",
    whatToExpect:
      "15-20 minutes. small pinches. results show in 5-14 days and last 3-4 months.",
    downtime: "back to normal same day. avoid lying flat or workouts for 4 hours.",
    priceFrom: 12,
    heroImage: IMG("1523170335258-f5ed11844a49"),
    heroTone: "bubblegum_scrim",
    descriptor: "the most researched treatment in aesthetics.",
  },
  {
    slug: "filler",
    name: "dermal filler",
    category: "volume restoration",
    group: "injectables",
    improves: ["volumeLoss", "wrinkles", "symmetry"],
    whatItIs:
      "hyaluronic acid gel placed by a licensed injector to support areas that have lost volume. dissolvable.",
    whatToExpect:
      "30-60 minutes with numbing. mild swelling 1-3 days. results last 9-18 months.",
    downtime: "1-3 days of swelling or bruising possible.",
    priceFrom: 650,
    heroImage: IMG("1522337360788-8b13dee7a37e"),
    heroTone: "cream_scrim",
    descriptor: "structure, softened.",
  },
  {
    slug: "microneedling-rf",
    name: "microneedling with rf",
    category: "texture & collagen",
    group: "skin",
    improves: ["texture", "pores", "fineLines", "wrinkles"],
    whatItIs:
      "ultrafine needles create tiny channels while radiofrequency delivers heat into the deeper layer.",
    whatToExpect:
      "topical numbing, 45 minutes. skin is pink 24-48 hours. series of 3 recommended.",
    downtime: "24-48 hours of redness.",
    priceFrom: 550,
    heroImage: IMG("1512290923902-8a9f81dc236c"),
    heroTone: "mint_scrim",
    descriptor: "your skin, rebuilding itself.",
  },
  {
    slug: "ipl",
    name: "ipl photofacial",
    category: "pigmentation & redness",
    group: "laser",
    improves: ["pigmentation", "darkSpots", "redness"],
    whatItIs:
      "broad-spectrum light targets brown spots and broken capillaries. commonly used for uneven tone.",
    whatToExpect:
      "30 minutes. feels like a warm rubber band snap. spots darken then flake off over 7-10 days.",
    downtime: "minimal, slight redness same day.",
    priceFrom: 350,
    heroImage: IMG("1571019613454-1cb2f99b2d8b"),
    heroTone: "butter_scrim",
    descriptor: "light, tuned to your tone.",
  },
  {
    slug: "chemical-peel",
    name: "chemical peel",
    category: "tone & texture",
    group: "skin",
    improves: ["pigmentation", "texture", "darkSpots", "fineLines"],
    whatItIs:
      "a solution of medical acids applied to clean skin for a set time. depth is tuned to your skin.",
    whatToExpect:
      "30 minutes. mild tingling. light flaking for 3-7 days depending on depth.",
    downtime: "3-7 days of flaking.",
    priceFrom: 175,
    heroImage: IMG("1556228720-195a672e8a03"),
    heroTone: "butter_scrim",
    descriptor: "shed the surface.",
  },
  {
    slug: "laser-resurfacing",
    name: "laser resurfacing",
    category: "wrinkles & texture",
    group: "laser",
    improves: ["wrinkles", "fineLines", "texture", "pigmentation"],
    whatItIs:
      "fractional laser drops microscopic columns of heat into the skin in a grid pattern to prompt remodeling.",
    whatToExpect:
      "45 minutes with numbing. skin feels sunburned for 3-5 days.",
    downtime: "5-7 days of pinkness and peeling.",
    priceFrom: 850,
    heroImage: IMG("1519415387722-a1c3bbef716c"),
    heroTone: "cream_scrim",
    descriptor: "resurface, don't restart.",
  },
  {
    slug: "prp",
    name: "platelet rich plasma (prp)",
    category: "regenerative",
    group: "skin",
    improves: ["texture", "hair", "hydration"],
    whatItIs:
      "a concentrate of platelets and growth factors made from your own blood, delivered back into the skin or scalp.",
    whatToExpect:
      "60 minutes including draw and centrifuge. minimal downtime.",
    downtime: "up to 24 hours of pinkness.",
    priceFrom: 600,
    heroImage: IMG("1503262028195-93c528f03218"),
    heroTone: "bubblegum_scrim",
    descriptor: "your own biology, put back to work.",
  },
  {
    slug: "medical-facial",
    name: "medical facial",
    category: "maintenance",
    group: "skin",
    improves: ["hydration", "texture", "pores"],
    whatItIs:
      "a customized facial designed and delivered inside a medical practice, tuned to your skin that day.",
    whatToExpect: "60 minutes, deeply relaxing.",
    downtime: "no real downtime.",
    priceFrom: 180,
    heroImage: IMG("1570172619644-dfd03ed5d881"),
    heroTone: "mint_scrim",
    descriptor: "your baseline, elevated.",
  },
  {
    slug: "skin-booster",
    name: "skin booster (profhilo / volite)",
    category: "deep hydration",
    group: "injectables",
    improves: ["hydration", "fineLines", "texture", "volumeLoss"],
    whatItIs:
      "micro-injections of pure hyaluronic acid spread across the face for deep hydration.",
    whatToExpect: "20 minutes. tiny bumps for a few hours. results build over 4 weeks.",
    downtime: "tiny bumps for 4-8 hours.",
    priceFrom: 600,
    heroImage: IMG("1620916566398-39f1143ab7be"),
    heroTone: "cream_scrim",
    descriptor: "hydration, from the inside.",
  },
];

export function getTreatment(slug: string): Treatment | undefined {
  return TREATMENTS.find((t) => t.slug === slug);
}

export const GROUP_ORDER: TreatmentGroup[] = ["injectables", "skin", "laser", "body"];
export const GROUP_LABEL: Record<TreatmentGroup, string> = {
  injectables: "Injectables",
  skin: "Skin",
  laser: "Laser & light",
  body: "Body",
};

// Seeded clinics (GTA-ish). Distance is computed loosely from a fake origin.
export type Clinic = {
  id: string;
  name: string;
  area: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  injectorTitle: "MD" | "RN" | "NP";
  nextSlot: string;
  basePriceMultiplier: number;
  kmFromCentre: number;
};

export const CLINICS: Clinic[] = [
  { id: "c1", name: "atelier aesthetics", area: "yorkville", rating: 4.9, reviewCount: 412, verified: true, injectorTitle: "MD", nextSlot: "tomorrow · 11:00am", basePriceMultiplier: 1.15, kmFromCentre: 1.2 },
  { id: "c2", name: "skin lab toronto", area: "queen west", rating: 4.8, reviewCount: 287, verified: true, injectorTitle: "RN", nextSlot: "fri · 2:30pm", basePriceMultiplier: 1.0, kmFromCentre: 2.8 },
  { id: "c3", name: "the glow room", area: "king west", rating: 4.7, reviewCount: 198, verified: true, injectorTitle: "NP", nextSlot: "today · 5:45pm", basePriceMultiplier: 0.95, kmFromCentre: 3.4 },
  { id: "c4", name: "dr. mei aesthetics", area: "rosedale", rating: 5.0, reviewCount: 156, verified: true, injectorTitle: "MD", nextSlot: "mon · 9:15am", basePriceMultiplier: 1.25, kmFromCentre: 2.1 },
  { id: "c5", name: "kindred medspa", area: "leslieville", rating: 4.6, reviewCount: 321, verified: true, injectorTitle: "RN", nextSlot: "sat · 12:30pm", basePriceMultiplier: 0.9, kmFromCentre: 6.5 },
  { id: "c6", name: "lumi clinic", area: "liberty village", rating: 4.8, reviewCount: 244, verified: true, injectorTitle: "NP", nextSlot: "tomorrow · 3:00pm", basePriceMultiplier: 1.05, kmFromCentre: 4.1 },
  { id: "c7", name: "north face aesthetics", area: "north york", rating: 4.7, reviewCount: 189, verified: true, injectorTitle: "MD", nextSlot: "wed · 10:00am", basePriceMultiplier: 1.0, kmFromCentre: 12.4 },
  { id: "c8", name: "soft skin co.", area: "the beaches", rating: 4.5, reviewCount: 92, verified: true, injectorTitle: "RN", nextSlot: "thu · 6:00pm", basePriceMultiplier: 0.85, kmFromCentre: 8.7 },
  { id: "c9", name: "maison derm", area: "summerhill", rating: 4.9, reviewCount: 367, verified: true, injectorTitle: "MD", nextSlot: "tomorrow · 9:00am", basePriceMultiplier: 1.2, kmFromCentre: 2.9 },
  { id: "c10", name: "the tx studio", area: "mississauga", rating: 4.6, reviewCount: 158, verified: true, injectorTitle: "NP", nextSlot: "sat · 11:15am", basePriceMultiplier: 0.95, kmFromCentre: 22.0 },
  { id: "c11", name: "halo aesthetics", area: "etobicoke", rating: 4.7, reviewCount: 211, verified: true, injectorTitle: "RN", nextSlot: "fri · 4:45pm", basePriceMultiplier: 0.9, kmFromCentre: 14.3 },
  { id: "c12", name: "dr. okafor clinic", area: "midtown", rating: 4.95, reviewCount: 502, verified: true, injectorTitle: "MD", nextSlot: "mon · 1:30pm", basePriceMultiplier: 1.3, kmFromCentre: 5.6 },
];
