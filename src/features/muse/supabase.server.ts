import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FREE_SCANS_PER_DAY } from "./concerns";

/**
 * server-only supabase helpers.
 * this file is never bundled for the browser (".server" suffix convention).
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

/** resolve the supabase user from a bearer token on the request. */
export async function getUserFromRequest(
  request: Request,
): Promise<AuthedUser | null> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!url || !anon || !token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function isPremium(userId: string): Promise<boolean> {
  const db = serviceClient();
  if (!db) return false;
  const { data } = await db
    .from("profiles")
    .select("is_premium")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_premium === true;
}

/** how many scans this user has run since midnight utc. */
export async function countScansToday(userId: string): Promise<number> {
  const db = serviceClient();
  if (!db) return 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from("muse_scan_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

export async function scansRemainingToday(userId: string): Promise<number> {
  if (await isPremium(userId)) return Number.POSITIVE_INFINITY;
  const used = await countScansToday(userId);
  return Math.max(0, FREE_SCANS_PER_DAY - used);
}

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export { serviceClient };
