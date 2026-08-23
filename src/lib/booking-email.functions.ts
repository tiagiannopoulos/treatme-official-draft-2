import { createServerFn } from "@tanstack/react-start";

/**
 * emails the treatme inbox so a human can phone the clinic. this never confirms
 * anything to the patient, and a failure here must never lose the request.
 */
export const sendBookingRequestEmail = createServerFn({ method: "POST" })
  .inputValidator((input: BookingEmailInput) => input)
  .handler(async ({ data }) => {
    const key = process.env["RESEND_API_KEY"];
    if (!key) {
      console.error("booking request email skipped: RESEND_API_KEY is not set", data.requestId);
      return { sent: false };
    }

    const projectRef = process.env["SUPABASE_PROJECT_ID"] ?? "";
    const rowLink = projectRef
      ? `https://supabase.com/dashboard/project/${projectRef}/editor?sql=${encodeURIComponent(
          `select * from booking_requests where id = '${data.requestId}';`,
        )}`
      : `request id ${data.requestId}`;

    const lines = [
      `patient: ${data.patientName}`,
      `email: ${data.patientEmail}`,
      `phone: ${data.patientPhone}`,
      "",
      `clinic: ${data.storefrontName}`,
      `clinic phone: ${data.storefrontPhone ?? "not on file"}`,
      `clinic address: ${data.storefrontAddress}`,
      "",
      `treatment: ${data.treatmentName}`,
      `provider: ${data.providerName ?? "no preference"}`,
      "",
      "preferred times:",
      ...data.preferred.map((p, i) => `  ${i + 1}. ${p}`),
      `flexibility: ${data.flexibility}`,
      `first visit here: ${data.isFirstTime === null ? "not said" : data.isFirstTime ? "yes" : "no"}`,
      "",
      `notes: ${data.notes ?? "none"}`,
      "",
      `request row: ${rowLink}`,
    ];

    const from = (await domainVerified(key)) ? "bookings@treatmeapp.com" : "onboarding@resend.dev";
    const inbox = process.env["TREATME_BOOKINGS_INBOX"] ?? "bookings@treatmeapp.com";

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: `treatme bookings <${from}>`,
          to: [inbox],
          reply_to: data.patientEmail,
          subject: `booking request · ${data.treatmentName} · ${data.storefrontName}`,
          text: lines.join("\n"),
        }),
      });
      if (!res.ok) {
        console.error("booking request email failed", data.requestId, res.status, await res.text());
        return { sent: false };
      }
      return { sent: true };
    } catch (err) {
      console.error("booking request email threw", data.requestId, err);
      return { sent: false };
    }
  });

/** asks resend once per worker whether our own domain can send yet. */
let verifiedCache: boolean | null = null;
async function domainVerified(key: string): Promise<boolean> {
  if (verifiedCache !== null) return verifiedCache;
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      verifiedCache = false;
      return false;
    }
    const body = (await res.json()) as { data?: Array<{ name?: string; status?: string }> };
    verifiedCache = (body.data ?? []).some(
      (d) => d.name === "treatmeapp.com" && d.status === "verified",
    );
    return verifiedCache;
  } catch {
    verifiedCache = false;
    return false;
  }
}

export interface BookingEmailInput {
  requestId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  storefrontName: string;
  storefrontPhone: string | null;
  storefrontAddress: string;
  treatmentName: string;
  providerName: string | null;
  preferred: string[];
  flexibility: string;
  isFirstTime: boolean | null;
  notes: string | null;
}
