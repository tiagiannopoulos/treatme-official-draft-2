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

export interface SubmitBooking {
  providerId: string;
  storefrontId: string;
  treatmentSlug: string;
  slots: PreferredSlot[];
  note: string;
  name: string;
  phone: string;
  email: string;
}

/** inserts one request as the signed in patient. rls scopes it to auth.uid(). */
export async function submitBookingRequest(input: SubmitBooking): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("you need an account to send a request.");

  const { error } = await supabase.from("booking_requests").insert({
    patient_id: uid,
    provider_id: input.providerId,
    storefront_id: input.storefrontId,
    treatment_slug: input.treatmentSlug,
    preferred_slots: input.slots.map((s) => ({ date: s.date, time_of_day: s.time_of_day })),
    note: input.note.trim() ? input.note.trim() : null,
    patient_name: input.name.trim(),
    patient_phone: input.phone.trim(),
    patient_email: input.email.trim(),
  });
  if (error) throw new Error(error.message);
}

export interface MyBooking {
  id: string;
  status: string;
  created_at: string;
  slots: PreferredSlot[];
  treatmentName: string;
  providerName: string;
  providerId: string;
  storefrontName: string;
  storefrontId: string;
  neighbourhood: string | null;
}

export const myBookingsQuery = queryOptions({
  queryKey: ["my-bookings"],
  queryFn: async (): Promise<MyBooking[]> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user.id) return [];

    const { data, error } = await supabase
      .from("booking_requests")
      .select("id, status, created_at, preferred_slots, treatment_slug, provider_id, storefront_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) return [];

    const [{ data: provs }, { data: stores }, { data: treats }] = await Promise.all([
      supabase.from("providers").select("id, name").in("id", rows.map((r) => r.provider_id)),
      supabase
        .from("storefronts")
        .select("id, name, neighbourhood")
        .in("id", rows.map((r) => r.storefront_id)),
      supabase
        .from("treatments")
        .select("slug, name")
        .in("slug", rows.map((r) => r.treatment_slug ?? "").filter(Boolean)),
    ]);

    const provName = new Map((provs ?? []).map((p) => [p.id, p.name]));
    const storeById = new Map((stores ?? []).map((s) => [s.id, s]));
    const treatName = new Map((treats ?? []).map((t) => [t.slug, t.name]));

    return rows.map((r) => {
      const store = storeById.get(r.storefront_id);
      return {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        slots: Array.isArray(r.preferred_slots) ? (r.preferred_slots as unknown as PreferredSlot[]) : [],
        treatmentName: (r.treatment_slug ? treatName.get(r.treatment_slug) : null) ?? "treatment",
        providerName: provName.get(r.provider_id) ?? "your provider",
        providerId: r.provider_id,
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

export function statusChip(status: string): { label: string; bg: string; fg: string } {
  if (status === "confirmed") return { label: "confirmed", bg: "#DFFFF8", fg: "#111111" };
  if (status === "declined") return { label: "declined", bg: "#ECECEC", fg: "#6B6B6B" };
  return { label: "pending", bg: "#FFEDB4", fg: "#111111" };
}
