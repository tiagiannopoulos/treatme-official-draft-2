import type { Provider } from "@/lib/search-data";
import type { PatientProfile } from "@/lib/patient-store";

/**
 * "who this provider is right for". declarations the provider makes, matched
 * against the patient's saved about your skin answers. honest beats flattering,
 * so a mismatch is stated plainly, in cream, never in red.
 */
export type FitTone = "match" | "plain" | "neutral";

export interface FitSignal {
  id: string;
  icon: "skin" | "language" | "treats" | "device";
  label: string;
  tone: FitTone;
}

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi"];

export function fitzRoman(n: number): string {
  return ROMAN[n] ?? String(n);
}

function lower(list: string[]): string[] {
  return list.map((s) => s.toLowerCase().trim()).filter(Boolean);
}

/** patient skin type is stored as a roman numeral string, e.g. "iv". */
function fitzNumber(value: string | null): number | null {
  if (!value) return null;
  const i = ROMAN.indexOf(value.toLowerCase().trim());
  return i > 0 ? i : null;
}

export function providerFit(p: Provider, profile: PatientProfile): FitSignal[] {
  const out: FitSignal[] = [];

  if (p.fitzpatrick_min !== null && p.fitzpatrick_max !== null) {
    out.push({
      id: "fitz",
      icon: "skin",
      label:
        p.fitzpatrick_min === p.fitzpatrick_max
          ? `works with fitzpatrick ${fitzRoman(p.fitzpatrick_min)}`
          : `works with fitzpatrick ${fitzRoman(p.fitzpatrick_min)} to ${fitzRoman(p.fitzpatrick_max)}`,
      tone: "neutral",
    });
  }

  const langs = lower(p.languages ?? []);
  if (langs.length) {
    out.push({ id: "langs", icon: "language", label: `speaks ${langs.join(", ")}`, tone: "neutral" });
  }

  const treats = lower(p.treats?.length ? p.treats : (p.specialties ?? []));
  if (treats.length) {
    out.push({ id: "treats", icon: "treats", label: `treats: ${treats.join(", ")}`, tone: "neutral" });
  }

  const devices = lower(p.devices ?? []);
  if (devices.length) {
    out.push({ id: "devices", icon: "device", label: `devices on site: ${devices.join(", ")}`, tone: "neutral" });
  }

  // compare against the patient's saved skin type. silent when they have none.
  const patientFitz = fitzNumber(profile.skinType);
  if (patientFitz !== null && p.fitzpatrick_min !== null && p.fitzpatrick_max !== null) {
    const inside = patientFitz >= p.fitzpatrick_min && patientFitz <= p.fitzpatrick_max;
    out.push({
      id: "skin-match",
      icon: "skin",
      label: inside
        ? "matches your skin type"
        : "this provider does not list experience with your skin type",
      tone: inside ? "match" : "plain",
    });
  }

  return out;
}

/** "license verified · cno #123456". never render a negative or pending state. */
export function licenseLine(p: Provider): string | null {
  if (!p.license_verified) return null;
  const body = (p.licensing_body ?? "").trim().toLowerCase();
  const num = (p.license_number ?? "").trim();
  if (body && num) return `license verified · ${body} #${num}`;
  if (body) return `license verified · ${body}`;
  return "license verified";
}
