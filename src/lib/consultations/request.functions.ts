import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CreateRequestSchema = z.object({
  accessToken: z.string().min(10).max(4096),
  storefrontId: z.string().uuid(),
  providerId: z.string().uuid().nullable().optional(),
  treatmentSlug: z.string().trim().min(1).max(120),
  slots: z.array(z.string().datetime()).min(1).max(3),
  note: z.string().trim().max(600),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(254),
  flexibility: z.enum(["very", "somewhat", "these times only"]).nullable().optional(),
  isFirstTime: z.boolean().nullable().optional(),
  consentToContact: z.literal(true),
});
const InboxSchema = z.object({ accessToken: z.string().min(10).max(4096) });
const PublicClinicSchema = z.object({ slug: z.string().min(1).max(130).regex(/^[a-z0-9-]+$/) });

type Admin = Awaited<ReturnType<typeof getAdmin>>;
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
type Partner = {
  storefront_id: string;
  owner_user_id: string;
  booking_email: string;
  status: string;
  subscription_status: string;
  verified_at: string | null;
};
function isActivePartner(p: Partner | null): p is Partner {
  return Boolean(p && p.status === "active" && p.verified_at &&
    (p.subscription_status === "active" || p.subscription_status === "trialing"));
}
async function findActivePartner(db: Admin, storefrontId: string) {
  const { data, error } = await db.from("clinic_partner_accounts")
    .select("storefront_id,owner_user_id,booking_email,status,subscription_status,verified_at")
    .eq("storefront_id", storefrontId).maybeSingle();
  if (error) throw new Error("Clinic membership lookup failed.");
  const p = data as Partner | null;
  return isActivePartner(p) ? p : null;
}
async function authenticatedUser(db: Admin, token: string) {
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in again.");
  return data.user;
}

/** Send a notification with no patient contact details, notes, photos, or medical information. */
async function deliverNotice(db: Admin, requestId: string, to: string | null, clinicName: string, target: "clinic" | "admin") {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const notice = await db.from("booking_request_notices")
    .insert({ request_id: requestId, recipient_type: target, recipient_email: to, delivery_status: "pending" })
    .select("id").single();
  if (notice.error || !notice.data) {
    console.error("Consultation notice creation failed", requestId);
    return false;
  }
  try {
    const from = process.env.TREATME_EMAIL_FROM || "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
        "Idempotency-Key": "treatme-consult-" + requestId + "-" + target,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "TreatMe: new consultation request",
        text: "A consultation was requested at " + clinicName +
          ". Sign in to your authorized TreatMe inbox to review it.\n\n" +
          "Request reference: " + requestId + "\n" +
          "Open your dashboard: https://treatmeapp.com/inbox\n\n" +
          "This is a request, not a confirmed appointment.",
      }),
    });
    const ok = res.ok;
    await db.from("booking_request_notices").update({
      delivery_status: ok ? "sent" : "failed",
      sent_at: ok ? new Date().toISOString() : null,
    }).eq("id", notice.data.id);
    if (!ok) console.error("Consultation notification failed", requestId, res.status);
    return ok;
  } catch {
    await db.from("booking_request_notices").update({ delivery_status: "failed" }).eq("id", notice.data.id);
    console.error("Consultation notification service unavailable", requestId);
    return false;
  }
}

/** Safe, server-controlled booking request entry point for both TreatMe journeys. */
export const submitConsultationRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await getAdmin();
    const user = await authenticatedUser(db, data.accessToken);
    const email = data.email.trim().toLowerCase();
    if (!user.email || user.email.toLowerCase() !== email) {
      throw new Error("Please use the email associated with your TreatMe account.");
    }

    const { data: clinic, error: clinicError } = await db.from("storefronts")
      .select("id,name").eq("id", data.storefrontId).maybeSingle();
    if (clinicError || !clinic) throw new Error("Selected clinic is unavailable.");

    // Initial anti-spam limit for a given contact address. Add Turnstile and IP controls before a public rollout.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await db.from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", since);
    if (rateError) throw new Error("Please try again later.");
    if ((count ?? 0) >= 3) throw new Error("Too many consultation requests. Please try again later.");

    const partner = await findActivePartner(db, data.storefrontId);
    const route = partner ? "clinic" : "admin";
    const { data: created, error } = await db.from("booking_requests")
      .insert({
        user_id: user.id,
        provider_id: data.providerId ?? null,
        storefront_id: data.storefrontId,
        treatment_slug: data.treatmentSlug,
        full_name: data.fullName,
        email,
        phone: data.phone,
        preferred_1: data.slots[0] ?? null,
        preferred_2: data.slots[1] ?? null,
        preferred_3: data.slots[2] ?? null,
        flexibility: data.flexibility ?? null,
        is_first_time: data.isFirstTime ?? null,
        notes: data.note || null,
        status: "new",
        routing_target: route,
        contact_consent_at: new Date().toISOString(),
      })
      .select("id").single();
    if (error || !created) {
      console.error("Consultation insert failed", error?.code);
      throw new Error("Could not save your request. Please try again.");
    }
    const recipient = partner?.booking_email || process.env.TREATME_BOOKINGS_INBOX || null;
    // Saving the request is authoritative; email is a separate best-effort delivery.
    await deliverNotice(db, created.id, recipient, clinic.name, route);
    return { requestId: created.id, status: "pending" as const };
  });

/** Admin and active clinics may view their permitted consultation inboxes, never each other's. */
export const loadConsultationInbox = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InboxSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await getAdmin();
    const user = await authenticatedUser(db, data.accessToken);
    const admins = (process.env.TREATME_ADMIN_USER_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
    const isAdmin = admins.includes(user.id);
    let requestQuery = db.from("booking_requests")
      .select("id,created_at,storefront_id,full_name,email,phone,notes,treatment_slug,preferred_1,preferred_2,preferred_3,status,routing_target")
      .order("created_at", { ascending: false }).limit(100);
    if (isAdmin) {
      requestQuery = requestQuery.eq("routing_target", "admin");
    } else {
      const { data: accounts, error: accountError } = await db.from("clinic_partner_accounts")
        .select("storefront_id,owner_user_id,booking_email,status,subscription_status,verified_at")
        .eq("owner_user_id", user.id);
      if (accountError) throw new Error("Could not verify clinic permissions.");
      const allowed = ((accounts || []) as Partner[]).filter(isActivePartner).map((p) => p.storefront_id);
      if (!allowed.length) return { role: "none" as const, requests: [] };
      requestQuery = requestQuery.in("storefront_id", allowed).eq("routing_target", "clinic");
    }
    const { data: requests, error } = await requestQuery;
    if (error) throw new Error("Could not load authorized requests.");
    return { role: isAdmin ? "admin" as const : "clinic" as const, requests: requests ?? [] };
  });

/** Branded links are enabled only for verified, active partner clinics. */
export const getPublicBrandedClinic = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => PublicClinicSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await getAdmin();
    const { data: clinic } = await db.from("storefronts")
      .select("id,slug,name,city,logo_url,brand_accent")
      .eq("slug", data.slug).maybeSingle();
    if (!clinic || !(await findActivePartner(db, clinic.id))) return null;
    return clinic;
  });
