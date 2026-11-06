import { z } from "zod";

/** Shared server validation for every TreatMe consultation entry point. */
export const CreateRequestSchema = z.object({
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

export type Partner = {
  storefront_id: string;
  owner_user_id: string;
  booking_email: string;
  status: string;
  subscription_status: string;
  verified_at: string | null;
};

/** A claimed listing alone is never permitted to receive consultation data. */
export function isActivePartner(p: Partner | null): p is Partner {
  return Boolean(
    p &&
    p.owner_user_id &&
    p.booking_email?.trim() &&
    p.status === "active" &&
    p.verified_at &&
    (p.subscription_status === "active" || p.subscription_status === "trialing"),
  );
}

export function requestRoutingTarget(p: Partner | null): "clinic" | "admin" {
  return isActivePartner(p) ? "clinic" : "admin";
}
