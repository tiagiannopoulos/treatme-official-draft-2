import type { Provider } from "@/lib/search-data";
import type { PatientProfile } from "@/lib/patient-store";

/**
 * "who this provider is right for". declarations the provider makes, matched
 * against the patient's about your skin answers. honest beats flattering, so a
 * conflict is stated as plainly as a match.
 */
export type FitTone = "match" | "conflict" | "neutral";

export interface FitSignal {
  id: string;
  label: string;
  tone: FitTone;
}

function lower(list: string[]): string[] {
  return list.map((s) => s.toLowerCase().trim()).filter(Boolean);
}

function overlap(a: string[], b: string[]): string[] {
  return lower(a).filter((x) => lower(b).some((y) => y.includes(x) || x.includes(y)));
}

export function providerFit(p: Provider, profile: PatientProfile): FitSignal[] {
  const out: FitSignal[] = [];

  // concerns the provider declares they treat
  const treats = lower(p.specialties ?? []);
  if (treats.length) {
    const shared = overlap(profile.workingOn, treats);
    out.push({
      id: "treats",
      label: `treats: ${treats.join(", ")}`,
      tone: shared.length ? "match" : "neutral",
    });
    if (profile.workingOn.length && !shared.length) {
      out.push({
        id: "treats-conflict",
        label: `this provider does not list experience with ${lower(profile.workingOn).join(" or ")}`,
        tone: "conflict",
      });
    }
  }

  // languages
  const langs = lower(p.languages ?? []);
  if (langs.length) {
    const shared = overlap(profile.languages, langs);
    out.push({
      id: "languages",
      label: `speaks ${langs.join(", ")}`,
      tone: shared.length ? "match" : "neutral",
    });
    if (profile.languages.length && !shared.length) {
      out.push({
        id: "languages-conflict",
        label: `does not list ${lower(profile.languages).join(" or ")}`,
        tone: "conflict",
      });
    }
  }

  // skin type. no provider in alpha has declared a fitzpatrick range yet, so
  // the honest answer is that it is unknown rather than implied.
  if (profile.skinType) {
    out.push({
      id: "skin-type",
      label: `this provider has not listed experience with fitzpatrick type ${profile.skinType}`,
      tone: "conflict",
    });
  }

  // treatments they actually list, used as the on site capability signal
  const families = Array.from(new Set(p.treatments.map((t) => t.category).filter(Boolean)));
  if (families.length) {
    out.push({
      id: "offers",
      label: `works in ${lower(families).slice(0, 3).join(", ")}`,
      tone: "neutral",
    });
  }

  if (!profile.skinType && !profile.workingOn.length && !profile.languages.length) {
    out.push({
      id: "prompt",
      label: "answer about your skin and treatme will tell you whether this provider fits you",
      tone: "neutral",
    });
  }

  return out;
}

/** license verified · cno. never render an unverified state, it reads as an accusation. */
export function licenseLine(p: Provider): string | null {
  if (!p.verified) return null;
  const body = (p.licensing_body ?? "").trim().toLowerCase();
  return body ? `license verified · ${body}` : "license verified";
}
