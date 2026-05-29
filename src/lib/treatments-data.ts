// Catalogue of treatments + seeded clinics for the MVP flow.
// Slugs are what the model is asked to recommend (see /api/analyze prompt).

export type Treatment = {
  slug: string;
  name: string;
  category: string;
  improves: string[];
  whatItIs: string;
  whatToExpect: string;
  downtime: string;
  priceFrom: number;
};

export const TREATMENTS: Treatment[] = [
  {
    slug: "hydrafacial",
    name: "hydrafacial",
    category: "deep cleansing & hydration",
    improves: ["hydration", "pores", "texture", "dullness"],
    whatItIs:
      "a medical-grade three-step facial: cleanse + exfoliate, extract debris from pores, then infuse the skin with hydrating and antioxidant serums. no needles, no downtime.",
    whatToExpect:
      "60 minutes. you'll feel suction (gentle vacuum), then cool serums. your skin reads brighter and plumper the same day.",
    downtime: "none",
    priceFrom: 189,
  },
  {
    slug: "botox",
    name: "neuromodulator (botox / dysport)",
    category: "fine lines & wrinkles",
    improves: ["fineLines", "wrinkles"],
    whatItIs:
      "tiny injections that relax the muscles creating expression lines. softens forehead, brow, and crow's feet without freezing the face.",
    whatToExpect:
      "15–20 minutes. small pinches. results show in 5–14 days and last 3–4 months.",
    downtime: "back to normal same day. avoid lying flat or workouts for 4 hours.",
    priceFrom: 12,
  },
  {
    slug: "filler",
    name: "dermal filler",
    category: "volume restoration",
    improves: ["volumeLoss", "wrinkles", "symmetry"],
    whatItIs:
      "hyaluronic acid placed precisely to restore lost volume in cheeks, temples, lips, or under-eyes. instant lift, dissolvable.",
    whatToExpect:
      "30–60 minutes with numbing. mild swelling for 1–3 days. results last 9–18 months.",
    downtime: "1–3 days of swelling/bruising possible.",
    priceFrom: 650,
  },
  {
    slug: "microneedling-rf",
    name: "microneedling with rf",
    category: "texture & collagen",
    improves: ["texture", "pores", "fineLines", "wrinkles"],
    whatItIs:
      "ultrafine needles deliver radiofrequency heat into the deep dermis to remodel collagen — tightens pores and smooths texture.",
    whatToExpect:
      "topical numbing, 45 minutes. skin is pink for 24–48 hours. series of 3 spaced 4 weeks apart for best results.",
    downtime: "24–48 hours of redness.",
    priceFrom: 550,
  },
  {
    slug: "ipl",
    name: "ipl photofacial",
    category: "pigmentation & redness",
    improves: ["pigmentation", "darkSpots", "redness"],
    whatItIs:
      "broad-spectrum light targets brown spots and broken capillaries. evens tone without harming surrounding skin.",
    whatToExpect:
      "30 minutes. feels like a warm rubber band snap. spots darken then flake off over 7–10 days.",
    downtime: "minimal — slight redness same day.",
    priceFrom: 350,
  },
  {
    slug: "chemical-peel",
    name: "medical chemical peel",
    category: "tone & texture",
    improves: ["pigmentation", "texture", "darkSpots", "fineLines"],
    whatItIs:
      "controlled acid resurfacing (glycolic, tca, or jessner's) to lift dull surface layers and trigger fresh, even skin.",
    whatToExpect:
      "30 minutes. mild tingling. light flaking for 3–7 days depending on depth.",
    downtime: "3–7 days of flaking.",
    priceFrom: 175,
  },
  {
    slug: "laser-resurfacing",
    name: "fractional laser resurfacing",
    category: "wrinkles & texture",
    improves: ["wrinkles", "fineLines", "texture", "pigmentation"],
    whatItIs:
      "fractional laser creates microscopic columns of heat that trigger deep collagen remodelling. the gold standard for crepiness and scars.",
    whatToExpect:
      "45 minutes with numbing. skin feels sunburned for 3–5 days.",
    downtime: "5–7 days of pinkness and peeling.",
    priceFrom: 850,
  },
  {
    slug: "skin-booster",
    name: "skin booster (profhilo / volite)",
    category: "deep hydration",
    improves: ["hydration", "fineLines", "texture", "volumeLoss"],
    whatItIs:
      "micro-injections of pure hyaluronic acid spread across the face for deep hydration and a quiet glow.",
    whatToExpect:
      "20 minutes. tiny bumps for a few hours. results build over 4 weeks.",
    downtime: "tiny bumps for 4–8 hours.",
    priceFrom: 600,
  },
];

export function getTreatment(slug: string): Treatment | undefined {
  return TREATMENTS.find((t) => t.slug === slug);
}

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
  basePriceMultiplier: number; // applied to treatment.priceFrom
  // distance buckets in km from a fake city centre
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
