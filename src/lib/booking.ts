import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TimeOfDay = "morning" | "afternoon" | "evening";
export const TIMES_OF_DAY: TimeOfDay[] = ["morning", "afternoon", "evening"];

export interface PreferredSlot {
  date: string; // yyyy-mm-dd
  time_of_day: TimeOfDay;
}

export interface ProviderOption {
  id: string;
  name: string;
  title: string | null;
  specialty: string | null;
}

export interface StorefrontOption {
  id: string;
  name: string;
  neighbourhood: string | null;
  city: string | null;
}

export interface TreatmentOption {
  slug: string;
  name: string;
  family: string | null;
}

/** everything the booking flow needs to show human readable names, never ids. */
export interface BookingOptions {
  providers: ProviderOption[];
  storefronts: StorefrontOption[];
  treatments: TreatmentOption[];
}

export const bookingOptionsQuery = (providerId?: string, storefrontId?: string) =>
  queryOptions({
    queryKey: ["booking-options", providerId ?? null, storefrontId ?? null],
    queryFn: async (): Promise<BookingOptions> => {
      const [providers, storefronts, treatments] = await Promise.all([
        fetchProviders(storefrontId),
        fetchStorefronts(providerId),
        fetchTreatments(providerId),
      ]);
      return { providers, storefronts, treatments };
    },
    staleTime: 5 * 60_000,
  });

async function fetchProviders(storefrontId?: string): Promise<ProviderOption[]> {
  if (storefrontId) {
    const { data } = await supabase
      .from("provider_storefronts")
      .select("providers!inner(id, name, title, specialties)")
      .eq("storefront_id", storefrontId);
    const rows = (data ?? []).map((r) => r.providers).filter(Boolean) as Array<{
      id: string;
      name: string;
      title: string | null;
      specialties: string[] | null;
    }>;
    if (rows.length) return rows.map(toProvider);
  }
  const { data } = await supabase
    .from("providers")
    .select("id, name, title, specialties")
    .order("rating", { ascending: false })
    .limit(40);
  return (data ?? []).map(toProvider);
}

function toProvider(r: { id: string; name: string; title: string | null; specialties: string[] | null }): ProviderOption {
  return {
    id: r.id,
    name: r.name,
    title: r.title ?? null,
    specialty: r.specialties?.[0] ?? null,
  };
}

async function fetchStorefronts(providerId?: string): Promise<StorefrontOption[]> {
  if (providerId) {
    const { data } = await supabase
      .from("provider_storefronts")
      .select("storefronts!inner(id, name, neighbourhood, city)")
      .eq("provider_id", providerId);
    const rows = (data ?? []).map((r) => r.storefronts).filter(Boolean) as StorefrontOption[];
    if (rows.length) return rows;
  }
  const { data } = await supabase
    .from("storefronts")
    .select("id, name, neighbourhood, city")
    .order("rating", { ascending: false })
    .limit(40);
  return (data ?? []) as StorefrontOption[];
}

async function fetchTreatments(providerId?: string): Promise<TreatmentOption[]> {
  if (providerId) {
    const { data } = await supabase
      .from("provider_treatments")
      .select("treatment_slug")
      .eq("provider_id", providerId);
    const slugs = (data ?? []).map((r) => r.treatment_slug);
    if (slugs.length) {
      const { data: rows } = await supabase
        .from("treatments")
        .select("slug, name, family")
        .in("slug", slugs)
        .order("name", { ascending: true });
      if (rows?.length) return rows as TreatmentOption[];
    }
  }
  const { data } = await supabase
    .from("treatments")
    .select("slug, name, family")
    .order("name", { ascending: true });
  return (data ?? []) as TreatmentOption[];
}

/** rough time of day to a local hour, so we never imply a real slot. */
const HOUR_FOR: Record<TimeOfDay, number> = { morning: 9, afternoon: 14, evening: 18 };

/** yyyy-mm-dd plus a rough time of day to an iso timestamp. */
export function slotToTimestamp(slot: PreferredSlot): string {
  const [y, m, d] = slot.date.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, HOUR_FOR[slot.time_of_day], 0, 0, 0);
  return dt.toISOString();
}

/** iso timestamp back to the rough shape the ui shows. */
export function timestampToSlot(iso: string): PreferredSlot {
  const dt = new Date(iso);
  const hour = dt.getHours();
  const time_of_day: TimeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { date, time_of_day };
}

export type Flexibility = "very" | "somewhat" | "these times only";

export interface SubmitBooking {
  /** optional. a request routes to the clinic, an individual is never required. */
  providerId?: string | null;
  storefrontId: string;
  treatmentSlug: string;
  slots: PreferredSlot[];
  note: string;
  name: string;
  phone: string;
  email: string;
  flexibility?: Flexibility;
  isFirstTime?: boolean | null;
}

/**
 * saves one request. signing in is optional, so user_id stays null for guests and
 * the row is the only record that matters. never says booked anywhere.
 */
export async function submitBookingRequest(input: SubmitBooking): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id ?? null;

  const times = input.slots.map(slotToTimestamp);

  const { data, error } = await supabase
    .from("booking_requests")
    .insert({
      user_id: uid,
      provider_id: input.providerId ? input.providerId : null,
      storefront_id: input.storefrontId,
      treatment_slug: input.treatmentSlug,
      full_name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      preferred_1: times[0] ?? null,
      preferred_2: times[1] ?? null,
      preferred_3: times[2] ?? null,
      flexibility: input.flexibility ?? null,
      is_first_time: input.isFirstTime ?? null,
      notes: input.note.trim() ? input.note.trim() : null,
      status: "new",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export interface MyBooking {
  id: string;
  status: string;
  created_at: string;
  slots: PreferredSlot[];
  treatmentName: string;
  providerName: string;
  providerId: string | null;
  storefrontName: string;
  storefrontId: string | null;
  neighbourhood: string | null;
}

export const myBookingsQuery = queryOptions({
  queryKey: ["my-bookings"],
  queryFn: async (): Promise<MyBooking[]> => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return [];

    // open requests only. a request never becomes an appointment on its own.
    const { data, error } = await supabase
      .from("booking_requests")
      .select("id, status, created_at, preferred_1, preferred_2, preferred_3, treatment_slug, provider_id, storefront_id")
      .eq("user_id", uid)
      .in("status", ["new", "contacting"])
      .order("created_at", { ascending: false });
    if (error) {
      console.error("booking_requests read failed", error);
      throw new Error(error.message);
    }
    const rows = data ?? [];
    if (!rows.length) return [];

    const [{ data: provs }, { data: stores }, { data: treats }] = await Promise.all([
      supabase
        .from("providers")
        .select("id, name")
        .in("id", rows.map((r) => r.provider_id).filter((id): id is string => Boolean(id))),
      supabase
        .from("storefronts")
        .select("id, name, neighbourhood")
        .in("id", rows.map((r) => r.storefront_id).filter((id): id is string => Boolean(id))),
      supabase
        .from("treatments")
        .select("slug, name")
        .in("slug", rows.map((r) => r.treatment_slug ?? "").filter(Boolean)),
    ]);

    const provName = new Map((provs ?? []).map((p) => [p.id, p.name]));
    const storeById = new Map((stores ?? []).map((s) => [s.id, s]));
    const treatName = new Map((treats ?? []).map((t) => [t.slug, t.name]));

    return rows.map((r) => {
      const store = r.storefront_id ? storeById.get(r.storefront_id) : undefined;
      const slots = [r.preferred_1, r.preferred_2, r.preferred_3]
        .filter((v): v is string => Boolean(v))
        .map(timestampToSlot);
      return {
        id: r.id,
        status: r.status ?? "new",
        created_at: r.created_at ?? new Date().toISOString(),
        slots,
        treatmentName: (r.treatment_slug ? treatName.get(r.treatment_slug) : null) ?? "treatment",
        providerName: (r.provider_id ? provName.get(r.provider_id) : null) ?? "no preference",
        providerId: r.provider_id ?? null,
        storefrontName: store?.name ?? "clinic",
        storefrontId: r.storefront_id,
        neighbourhood: store?.neighbourhood ?? null,
      };
    });
  },
  staleTime: 30_000,
});

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** yyyy-mm-dd to "august 14" with no dashes anywhere. */
export function slotDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * a request is never an appointment until a human confirms it, so the chip stays
 * honest: awaiting confirmation while it sits with the treatme team.
 */
export function statusChip(status: string): { label: string; bg: string; fg: string } {
  if (status === "declined") return { label: "could not arrange", bg: "#ECECEC", fg: "#6B6B6B" };
  if (status === "contacting") return { label: "awaiting confirmation", bg: "#FCFBF7", fg: "#111111" };
  return { label: "awaiting confirmation", bg: "#FCFBF7", fg: "#111111" };
}

/** a request is still just a request while it has one of these statuses. */
export function isPendingRequest(status: string): boolean {
  return status === "new" || status === "contacting" || status === "pending";
}
