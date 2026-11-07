import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isActivePartner, type Partner } from "@/lib/consultations/rules";
import { isTreatMeStaff } from "@/lib/workspace-access";

const Access = z.object({ accessToken: z.string().min(10).max(4096) });

export const loadTreatMeWorkspace = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => Access.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: identity, error: authError } = await db.auth.getUser(data.accessToken);
    if (authError || !identity.user) throw new Error("Please sign in again.");
    const userId = identity.user.id;
    const isStaff = isTreatMeStaff(userId, process.env.TREATME_ADMIN_USER_IDS || "");
    if (isStaff) {
      // Deliberately exclude patient names, contact details, notes and scans from summary.
      const [claims, memberships, notices, requests] = await Promise.all([
        db.from("storefront_claims").select("id,storefront_id,contact_name,role,work_email,work_phone,note,created_at").order("created_at", { ascending: false }).limit(100),
        db.from("clinic_partner_accounts").select("storefront_id,owner_user_id,booking_email,status,subscription_status,verified_at,created_at").order("created_at", { ascending: false }).limit(100),
        db.from("booking_request_notices").select("request_id,recipient_type,delivery_status,created_at").order("created_at", { ascending: false }).limit(100),
        db.from("booking_requests").select("id,storefront_id,status,routing_target,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (claims.error || memberships.error || notices.error || requests.error) {
        throw new Error("Could not load the TreatMe workspace. Check staging migrations.");
      }
      const partners = (memberships.data || []) as Partner[];
      const activeIds = new Set(partners.filter(isActivePartner).map((p) => p.storefront_id));
      return {
        role: "admin" as const,
        claims: claims.data || [],
        partners: memberships.data || [],
        notices: notices.data || [],
        requests: requests.data || [],
        activePartnerCount: activeIds.size,
      };
    }
    const { data: memberships, error } = await db.from("clinic_partner_accounts")
      .select("storefront_id,owner_user_id,booking_email,status,subscription_status,verified_at,created_at")
      .eq("owner_user_id", userId).limit(100);
    if (error) throw new Error("Could not verify your clinic membership.");
    const partners = (memberships || []) as Partner[];
    // Pending memberships may see only their own onboarding state, not client requests.
    return {
      role: "clinic" as const,
      partners: partners.map((p) => ({
        storefront_id: p.storefront_id,
        status: p.status,
        subscription_status: p.subscription_status,
        verified: Boolean(p.verified_at),
        active: isActivePartner(p),
      })),
    };
  });
