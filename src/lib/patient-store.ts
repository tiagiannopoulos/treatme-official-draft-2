import { useSyncExternalStore } from "react";

/**
 * patient answers and saved treatments, kept on the device the same way the
 * scan photo is. no account needed for alpha; one place to swap in a server
 * write later.
 */

const KEY = "treatme.patient.v1";

export interface SavedTreatment {
  slug: string;
  savedAt: number;
}

export type Downtime = "none" | "a day" | "a weekend" | "a full week";
export type Budget = "under $300" | "$300 to $800" | "$800 to $1500" | "$1500 plus";
export type ProviderPreference = "no preference" | "woman" | "man";
export type NeedleComfort = "fine" | "nervous" | "prefer to avoid";
export type Fitzpatrick = "i" | "ii" | "iii" | "iv" | "v" | "vi";

export interface PatientProfile {
  skinType: Fitzpatrick | null;
  workingOn: string[];
  goals: string;
  downtime: Downtime | null;
  budget: Budget | null;
  travelKm: number | null;
  providerPreference: ProviderPreference | null;
  languages: string[];
  needleComfort: NeedleComfort | null;
  mdOnly: boolean | null;
}

export interface HealthFlags {
  pregnantOrBreastfeeding: boolean;
  keloidHistory: boolean;
  recentIsotretinoin: boolean;
  autoimmuneCondition: boolean;
  bloodThinners: boolean;
  allergies: string;
  answered: boolean;
}

export interface PatientState {
  saved: SavedTreatment[];
  profile: PatientProfile;
  flags: HealthFlags;
}

const EMPTY: PatientState = {
  saved: [],
  profile: {
    skinType: null,
    workingOn: [],
    goals: "",
    downtime: null,
    budget: null,
    travelKm: null,
    providerPreference: null,
    languages: [],
    needleComfort: null,
    mdOnly: null,
  },
  flags: {
    pregnantOrBreastfeeding: false,
    keloidHistory: false,
    recentIsotretinoin: false,
    autoimmuneCondition: false,
    bloodThinners: false,
    allergies: "",
    answered: false,
  },
};

let state: PatientState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): PatientState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PatientState>;
    return {
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      profile: { ...EMPTY.profile, ...(parsed.profile ?? {}) },
      flags: { ...EMPTY.flags, ...(parsed.flags ?? {}) },
    };
  } catch {
    return EMPTY;
  }
}

function commit(next: PatientState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked, keep the in memory value */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  if (!hydrated) {
    hydrated = true;
    state = read();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** device scoped patient state. safe during ssr, hydrates on subscribe. */
export function usePatient(): PatientState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

export function isSaved(s: PatientState, slug: string) {
  return s.saved.some((t) => t.slug === slug);
}

export function saveTreatment(slug: string) {
  if (state.saved.some((t) => t.slug === slug)) return;
  commit({ ...state, saved: [{ slug, savedAt: Date.now() }, ...state.saved] });
  void import("@/lib/patient-sync").then((m) => m.syncSaved(state.saved));
}

export function removeTreatment(slug: string) {
  commit({ ...state, saved: state.saved.filter((t) => t.slug !== slug) });
  void import("@/lib/patient-sync").then((m) => m.syncSaved(state.saved, slug));
}

export function restoreTreatment(entry: SavedTreatment) {
  if (state.saved.some((t) => t.slug === entry.slug)) return;
  commit({
    ...state,
    saved: [...state.saved, entry].sort((a, b) => b.savedAt - a.savedAt),
  });
  void import("@/lib/patient-sync").then((m) => m.syncSaved(state.saved));
}

export function updateProfile(patch: Partial<PatientProfile>) {
  commit({ ...state, profile: { ...state.profile, ...patch } });
  void import("@/lib/patient-sync").then((m) => m.syncProfile(state.profile));
}

/** safety answers. these go to patient_health_flags only. */
export function updateFlags(patch: Partial<HealthFlags>) {
  commit({ ...state, flags: { ...state.flags, ...patch, answered: true } });
  void import("@/lib/patient-sync").then((m) => m.syncHealthFlags(state.flags));
}

/** the twelve answerable things in about your skin, safety included. */
export function answeredCount(s: PatientState): { filled: number; total: number } {
  const p = s.profile;
  const checks = [
    p.skinType !== null,
    p.workingOn.length > 0,
    p.goals.trim().length > 0,
    p.downtime !== null,
    p.budget !== null,
    p.travelKm !== null,
    p.providerPreference !== null,
    p.languages.length > 0,
    p.needleComfort !== null,
    p.mdOnly !== null,
    s.flags.answered,
  ];
  return { filled: checks.filter(Boolean).length, total: checks.length };
}

/** plain language read on what the current answers change. */
export function consequenceLines(s: PatientState): string[] {
  const p = s.profile;
  const out: string[] = [];
  if (p.skinType === "iv" || p.skinType === "v" || p.skinType === "vi") {
    out.push(
      `because your skin is a type ${p.skinType}, treatme shows nd:yag over diode for hair removal and hides medium depth peels.`,
    );
  }
  if (p.downtime === "none") out.push("treatme is hiding treatments that need more than a day of recovery.");
  if (p.downtime === "a day") out.push("treatme is keeping you to treatments you can recover from over one day.");
  if (p.budget) out.push(`treatme is sorting to what lands ${p.budget} a visit.`);
  if (p.travelKm !== null) out.push(`treatme is only showing providers within ${p.travelKm} km of you.`);
  if (p.mdOnly) out.push("treatme is only showing clinics where a physician is on site.");
  if (p.needleComfort === "prefer to avoid") out.push("treatme is leading with treatments that use no needles.");
  if (s.flags.pregnantOrBreastfeeding) out.push("treatme is hiding injectables and most energy based treatments while you are pregnant or breastfeeding.");
  if (s.flags.keloidHistory) out.push("treatme is flagging anything that breaks the skin, because of your scarring history.");
  if (s.flags.recentIsotretinoin) out.push("treatme is holding back resurfacing until you are six months clear of isotretinoin.");
  if (s.flags.bloodThinners) out.push("treatme is warning you where bruising risk is higher.");
  if (out.length === 0) out.push("answer a few of these and treatme starts filtering out what is not right for you.");
  return out;
}
