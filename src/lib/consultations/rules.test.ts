import { describe, expect, test } from "bun:test";
import { CreateRequestSchema, isActivePartner, mayRequestPartnerService, requestRoutingTarget, type Partner } from "./rules";

const candidate: Partner = {
  storefront_id: "11111111-1111-4111-8111-111111111111",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  booking_email: "clinic@example.com",
  status: "active",
  verified_at: "2026-11-01T12:00:00.000Z",
  subscription_status: "active",
};

const valid = {
  accessToken: "signed-in-session-token",
  storefrontId: "11111111-1111-4111-8111-111111111111",
  treatmentSlug: "consultation",
  slots: ["2026-12-02T14:00:00.000Z"],
  note: "",
  fullName: "Test Client",
  phone: "4165550199",
  email: "test@example.com",
  consentToContact: true as const,
};

describe("consultation data-sharing and routing rules", () => {
  test("only fully verified active subscribed clinics receive requests directly", () => {
    expect(isActivePartner(candidate)).toBe(true);
    expect(requestRoutingTarget(candidate)).toBe("clinic");
    expect(requestRoutingTarget({ ...candidate, status: "pending" })).toBe("admin");
    expect(requestRoutingTarget({ ...candidate, verified_at: null })).toBe("admin");
    expect(requestRoutingTarget({ ...candidate, subscription_status: "inactive" })).toBe("admin");
    expect(requestRoutingTarget({ ...candidate, subscription_status: "past_due" })).toBe("admin");
    expect(requestRoutingTarget({ ...candidate, booking_email: "" })).toBe("admin");
    expect(requestRoutingTarget(null)).toBe("admin");
    expect(requestRoutingTarget({ ...candidate, subscription_status: "trialing" })).toBe("clinic");
  });

  test("prevents a verified clinic from receiving another clinic's treatment requests", () => {
    expect(mayRequestPartnerService(candidate, "microneedling", false)).toBe(false);
    expect(mayRequestPartnerService(candidate, "microneedling", true)).toBe(true);
    expect(mayRequestPartnerService(candidate, "consultation", false)).toBe(true);
    expect(mayRequestPartnerService(null, "microneedling", false)).toBe(true); // routed to TreatMe admin
  });

  test("requires separate affirmative consent before recording a consultation", () => {
    expect(CreateRequestSchema.safeParse(valid).success).toBe(true);
    expect(CreateRequestSchema.safeParse({ ...valid, consentToContact: false }).success).toBe(false);
    const { consentToContact: _, ...missingConsent } = valid;
    expect(CreateRequestSchema.safeParse(missingConsent).success).toBe(false);
  });

  test("rejects malformed or excessive information rather than passing it to the database", () => {
    expect(CreateRequestSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(CreateRequestSchema.safeParse({ ...valid, storefrontId: "bad-id" }).success).toBe(false);
    expect(CreateRequestSchema.safeParse({ ...valid, slots: [] }).success).toBe(false);
    expect(CreateRequestSchema.safeParse({ ...valid, slots: Array(4).fill("2026-12-02T14:00:00.000Z") }).success).toBe(false);
    expect(CreateRequestSchema.safeParse({ ...valid, note: "X".repeat(601) }).success).toBe(false);
  });
});
