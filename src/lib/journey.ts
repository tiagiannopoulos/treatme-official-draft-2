import { queryOptions } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * the journey list is database truth. every save waits for the row to be
 * written before the ui claims it, and every read comes from journey_items.
 */

export const JOURNEY_QUERY_KEY = ["journey-items"] as const;

export interface JourneyRow {
  slug: string;
  status: string;
  createdAt: string;
}

export class NotSignedInError extends Error {
  constructor() {
    super("not signed in");
    this.name = "NotSignedInError";
  }
}

/** session or bust. an expired token is refreshed once before we give up. */
async function requireSession(): Promise<Session> {
  const { data } = await supabase.auth.getSession();
  const current = data.session;
  if (!current) throw new NotSignedInError();

  const expiresAt = current.expires_at ? current.expires_at * 1000 : null;
  if (expiresAt !== null && expiresAt <= Date.now() + 5_000) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) {
      console.error("journey: session refresh failed", error);
      throw new NotSignedInError();
    }
    return refreshed.session;
  }
  return current;
}

function looksLikeAuthError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return code === "PGRST301" || code === "42501" || message.includes("jwt") || message.includes("row-level security");
}

async function writeSave(uid: string, slug: string) {
  return supabase.from("journey_items").upsert(
    { user_id: uid, treatment_slug: slug, status: "curious" },
    { onConflict: "user_id,treatment_slug", ignoreDuplicates: true },
  );
}

/** waits for the row. already saved counts as saved, not as a failure. */
export async function saveJourneyItem(slug: string): Promise<void> {
  let session = await requireSession();
  let { error } = await writeSave(session.user.id, slug);

  if (error && looksLikeAuthError(error)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      console.error("journey: session refresh failed", refreshError);
      throw new NotSignedInError();
    }
    session = refreshed.session;
    ({ error } = await writeSave(session.user.id, slug));
  }

  if (error) {
    console.error("journey: save failed", error);
    throw error;
  }

  // mirror for the saved list and the checklist counts. best effort only.
  const mirror = await supabase
    .from("saved_treatments")
    .upsert({ user_id: session.user.id, treatment_slug: slug }, { onConflict: "user_id,treatment_slug", ignoreDuplicates: true });
  if (mirror.error) console.error("journey: saved_treatments mirror failed", mirror.error);
}

export async function removeJourneyItem(slug: string): Promise<void> {
  const session = await requireSession();
  const { error } = await supabase
    .from("journey_items")
    .delete()
    .eq("user_id", session.user.id)
    .eq("treatment_slug", slug);
  if (error) {
    console.error("journey: remove failed", error);
    throw error;
  }
  const mirror = await supabase
    .from("saved_treatments")
    .delete()
    .eq("user_id", session.user.id)
    .eq("treatment_slug", slug);
  if (mirror.error) console.error("journey: saved_treatments mirror failed", mirror.error);
}

export const journeyQuery = queryOptions({
  queryKey: JOURNEY_QUERY_KEY,
  queryFn: async (): Promise<JourneyRow[]> => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return [];
    const { data, error } = await supabase
      .from("journey_items")
      .select("treatment_slug, status, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("journey: read failed", error);
      throw error;
    }
    return (data ?? []).map((r) => ({
      slug: r.treatment_slug,
      status: r.status,
      createdAt: r.created_at ?? new Date().toISOString(),
    }));
  },
  staleTime: 30_000,
});
