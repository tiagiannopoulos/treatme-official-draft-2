import type { Provider, Storefront } from "@/lib/search-data";
import type { PatientProfile } from "@/lib/patient-store";
import { noDash } from "@/lib/storefront-detail";

/**
 * per clinic identity. brand_accent and the logo are the only things that change
 * between two storefronts, everything else stays treatme neutral.
 */
export const DEFAULT_ACCENT = "#F8A1C6";

export function accentOf(s: Pick<Storefront, "brand_accent">): string {
  const raw = (s.brand_accent ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : DEFAULT_ACCENT;
}

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** relative luminance, so text on the accent stays readable either way. */
export function isDarkAccent(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.62;
}

export function textOnAccent(hex: string): string {
  return isDarkAccent(hex) ? "#FCFBF7" : "#111111";
}

export function accentTint(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** "injectables · laser · skin · $$" built from what the clinic actually offers. */
export function categoryTags(families: string[], priceBand: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of families) {
    const label = noDash(f);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length === 3) break;
  }
  const band = (priceBand ?? "").trim();
  if (band) out.push(band.toLowerCase());
  return out;
}

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi"];

export function fitzNumber(value: string | null): number | null {
  if (!value) return null;
  const i = ROMAN.indexOf(value.toLowerCase().trim());
  return i > 0 ? i : null;
}

/** providers at this clinic who list experience with the patient's saved skin type. */
export function providersForSkinType(roster: Provider[], profile: PatientProfile): Provider[] {
  const fitz = fitzNumber(profile.skinType);
  if (fitz === null) return [];
  return roster.filter(
    (p) =>
      p.fitzpatrick_min !== null &&
      p.fitzpatrick_max !== null &&
      fitz >= p.fitzpatrick_min &&
      fitz <= p.fitzpatrick_max,
  );
}

/* ------------------------------------------------------------------ hours */

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_NAME: Record<string, string> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

function minutesOf(token: string): number | null {
  const m = token.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const mins = Number(m[2] ?? 0);
  const suffix = m[3];
  if (hour > 23 || mins > 59) return null;
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  // bare numbers in clinic hours are read the way a person would read them.
  if (!suffix && hour <= 8) hour += 12;
  return hour * 60 + mins;
}

export function clockLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export interface DayHours {
  key: string;
  label: string;
  /** display text for the full week list. */
  text: string;
  open: number | null;
  close: number | null;
}

/** accepts { mon: "9 to 6" } or { monday: "9:00 am to 7:00 pm" } plus "closed". */
export function weekHours(hours: unknown): DayHours[] {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return [];
  const raw = hours as Record<string, unknown>;
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string" && typeof v !== "number") continue;
    lookup.set(k.trim().toLowerCase(), String(v));
  }

  const out: DayHours[] = [];
  for (const key of DAY_ORDER) {
    const name = DAY_NAME[key]!;
    const value = lookup.get(key) ?? lookup.get(name) ?? null;
    if (value === null) continue;
    const clean = noDash(value);
    if (!clean || clean.includes("closed")) {
      out.push({ key, label: name, text: "closed", open: null, close: null });
      continue;
    }
    const parts = clean.split(/\s+to\s+/);
    const open = parts[0] ? minutesOf(parts[0]) : null;
    const close = parts[1] ? minutesOf(parts[1]) : null;
    out.push({
      key,
      label: name,
      text: open !== null && close !== null ? `${clockLabel(open)} to ${clockLabel(close)}` : clean,
      open,
      close,
    });
  }
  return out;
}

export function todayIndex(now = new Date()): number {
  return (now.getDay() + 6) % 7;
}

/** "open until 7:00 pm" or "closed, opens 9:00 am tomorrow". */
export function openStatus(week: DayHours[], now = new Date()): string | null {
  if (week.length === 0) return null;
  const byKey = new Map(week.map((d) => [d.key, d]));
  const idx = todayIndex(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = byKey.get(DAY_ORDER[idx]!) ?? null;

  if (today && today.open !== null && today.close !== null) {
    if (minutes >= today.open && minutes < today.close) return `open until ${clockLabel(today.close)}`;
    if (minutes < today.open) return `closed, opens ${clockLabel(today.open)} today`;
  }

  for (let step = 1; step <= 7; step += 1) {
    const next = byKey.get(DAY_ORDER[(idx + step) % 7]!);
    if (!next || next.open === null) continue;
    const when = step === 1 ? "tomorrow" : next.label;
    return `closed, opens ${clockLabel(next.open)} ${when}`;
  }
  return "closed";
}
