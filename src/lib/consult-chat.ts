import { supabase } from "@/integrations/supabase/client";
import { updateProfile, type Budget, type Downtime, type ProviderPreference } from "@/lib/patient-store";
import { SCAN_CONCERN_LABEL, bandFor, type ScanConcernRow } from "@/lib/scan-concerns";

/**
 * the consult chat's data layer. one consult_chats row per conversation,
 * linked to the user's most recent scan. everything the guide extracts is
 * merged into consult_chats.extracted and mirrored onto the patient profile so
 * the same question is never asked twice.
 */

export type ConsultStage = "intake" | "refine" | "summary" | "escalate";

export interface ConsultMessage {
  role: "user" | "assistant";
  text: string;
  chips?: string[];
  stage?: ConsultStage;
  treatmentSlugs?: string[];
}

export interface ConsultExtracted {
  primary_concern: string | null;
  area: string | null;
  goal: string | null;
  prior_treatments: string | null;
  sensitivities: string | null;
  budget: string | null;
  downtime: string | null;
  timeline: string | null;
  provider_preference: string | null;
  notes: string | null;
}

export interface ConsultTurn {
  message: string;
  chips: string[];
  stage: ConsultStage;
  extracted: ConsultExtracted;
  treatment_slugs: string[];
}

export const EMPTY_EXTRACTED: ConsultExtracted = {
  primary_concern: null,
  area: null,
  goal: null,
  prior_treatments: null,
  sensitivities: null,
  budget: null,
  downtime: null,
  timeline: null,
  provider_preference: null,
  notes: null,
};

/**
 * the key questions a real consult covers, in order. the guide works down this
 * list while still talking like a person, and the ui shows how far along we are.
 */
export const CONSULT_KEY_FIELDS = [
  "primary_concern",
  "area",
  "goal",
  "prior_treatments",
  "sensitivities",
  "budget",
  "downtime",
  "timeline",
  "provider_preference",
] as const satisfies readonly (keyof ConsultExtracted)[];

export const CONSULT_KEY_LABEL: Record<(typeof CONSULT_KEY_FIELDS)[number], string> = {
  primary_concern: "main concern",
  area: "area",
  goal: "goal",
  prior_treatments: "past treatments",
  sensitivities: "skin history",
  budget: "budget",
  downtime: "downtime",
  timeline: "timing",
  provider_preference: "who treats you",
};

/** how many of the key questions we already have answers to */
export function consultProgress(extracted: Partial<ConsultExtracted>): {
  answered: number;
  total: number;
  next: (typeof CONSULT_KEY_FIELDS)[number] | null;
} {
  const answered = CONSULT_KEY_FIELDS.filter((k) => Boolean(extracted[k])).length;
  const next = CONSULT_KEY_FIELDS.find((k) => !extracted[k]) ?? null;
  return { answered, total: CONSULT_KEY_FIELDS.length, next };
}

/** plain language summary of a scan, for the guide's opening turn */
export function scanSummary(rows: ScanConcernRow[], skinType?: string | null, skinTone?: string | null): string {
  if (!rows.length) return "";
  const ordered = [...rows].sort((a, b) => a.score - b.score).slice(0, 6);
  const lines = ordered.map(
    (r) => `- ${SCAN_CONCERN_LABEL[r.concern_key] ?? r.concern_key}: ${r.score}/100 (${bandFor(r.score)})`,
  );
  const head = [skinType ? `skin type: ${skinType}` : "", skinTone ? `skin tone: ${skinTone}` : ""]
    .filter(Boolean)
    .join(", ");
  return [head, `lowest scoring first:\n${lines.join("\n")}`].filter(Boolean).join("\n");
}

export async function callConsultTurn(input: {
  messages: { role: "user" | "assistant"; text: string }[];
  scanSummary?: string;
  known?: Partial<ConsultExtracted>;
  treatmentSlug?: string;
}): Promise<ConsultTurn> {
  const res = await fetch("/api/consult-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 429) throw new Error("we're getting a lot of questions right now. try again in a minute.");
    if (res.status === 402) throw new Error("the chat is out of credits for now.");
    throw new Error(detail || "the chat couldn't answer just now.");
  }
  return (await res.json()) as ConsultTurn;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** creates the chat row against the user's most recent scan. guests get null. */
export async function createConsultChat(): Promise<{ chatId: string | null; scanId: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { chatId: null, scanId: null };

  const { data: scan } = await supabase
    .from("scans")
    .select("id")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scanId = scan?.id ?? null;

  const { data, error } = await supabase
    .from("consult_chats")
    .insert({ user_id: uid, scan_id: scanId, messages: [], extracted: {}, status: "intake" })
    .select("id")
    .single();

  if (error) console.warn("consult chat insert failed", error.message);
  return { chatId: data?.id ?? null, scanId };
}

export async function persistConsultTurn(input: {
  chatId: string | null;
  messages: ConsultMessage[];
  extracted: ConsultExtracted;
  stage: ConsultStage;
}) {
  if (!input.chatId) return;
  const { error } = await supabase
    .from("consult_chats")
    .update({
      messages: input.messages as unknown as never,
      extracted: input.extracted as unknown as never,
      status: input.stage,
    })
    .eq("id", input.chatId);
  if (error) console.warn("consult chat update failed", error.message);
}

/** keeps whatever we already knew, layers in anything new */
export function mergeExtracted(prev: ConsultExtracted, next: Partial<ConsultExtracted>): ConsultExtracted {
  const out = { ...prev };
  for (const key of Object.keys(EMPTY_EXTRACTED) as (keyof ConsultExtracted)[]) {
    const value = next[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().toLowerCase();
  }
  return out;
}

const BUDGETS: Budget[] = ["under $300", "$300 to $800", "$800 to $1500", "$1500 plus"];
const DOWNTIMES: Downtime[] = ["none", "a day", "a weekend", "a full week"];
const PREFERENCES: ProviderPreference[] = ["no preference", "woman", "man"];

/** mirrors the chat's findings onto the patient profile so nothing is asked twice */
export function syncExtractedToProfile(extracted: ConsultExtracted) {
  const budget = BUDGETS.find((b) => b === extracted.budget) ?? null;
  const downtime = DOWNTIMES.find((d) => d === extracted.downtime) ?? null;
  const preference = PREFERENCES.find((p) => p === extracted.provider_preference) ?? null;

  const patch: Parameters<typeof updateProfile>[0] = {};
  if (budget) patch.budget = budget;
  if (downtime) patch.downtime = downtime;
  if (preference) patch.providerPreference = preference;
  if (extracted.primary_concern) patch.workingOn = [extracted.primary_concern];

  if (Object.keys(patch).length) updateProfile(patch);
}
