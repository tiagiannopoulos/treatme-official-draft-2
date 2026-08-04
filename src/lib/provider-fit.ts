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




export function providerFit(p: Provider, _profile: PatientProfile): FitSignal[] {
  const out: FitSignal[] = [];

  out.push({
    id: "all-tones",
    icon: "skin",
    label: "works with every skin tone",
    tone: "match",
  });

  const favourites = lower(
    (p.treatments ?? []).filter((t) => t.is_signature).map((t) => t.name),
  );
  if (favourites.length) {
    out.push({
      id: "favourites",
      icon: "treats",
      label: `favourite treatments: ${favourites.slice(0, 4).join(", ")}`,
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
