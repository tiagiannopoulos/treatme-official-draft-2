import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  accessToken: z.string().min(20).max(12000),
  requestId: z.string().uuid(),
});

/** A private room is provisioned only for a PAID, CONFIRMED session. No URL alone grants access. */
export const getConsultationVideoAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: verified, error: authError } = await db.auth.getUser(data.accessToken);
    const user = verified.user;
    if (authError || !user) throw new Error("sign in to join this consultation.");

    const { data: req, error: reqError } = await db.from("booking_requests")
      .select("id,user_id,storefront_id,status")
      .eq("id", data.requestId).maybeSingle();
    if (reqError || !req || !req.storefront_id || req.status !== "confirmed") {
      throw new Error("this consultation has not been confirmed.");
    }
    const { data: clinic, error: clinicError } = await db.from("clinic_accounts")
      .select("owner_user_id,status,billing_status,verified_at,notification_email")
      .eq("storefront_id", req.storefront_id).maybeSingle();
    if (clinicError || !clinic) throw new Error("clinic verification is required.");
    const active = clinic.status === "active" && !!clinic.verified_at &&
      (clinic.billing_status === "active" || clinic.billing_status === "trialing");
    if (!active) throw new Error("this clinic is not enabled for virtual consultations.");

    const provider = clinic.owner_user_id === user.id;
    const customer = req.user_id === user.id;
    if (!provider && !customer) throw new Error("this consultation is private.");

    const { data: session, error: sessionError } = await db.from("consultation_sessions")
      .select("id,start_at,end_at,payment_status")
      .eq("booking_request_id", req.id).maybeSingle();
    if (sessionError || !session || session.payment_status !== "paid") {
      throw new Error("the consultation is not ready for joining.");
    }
    const now = Date.now();
    const start = new Date(session.start_at).getTime();
    const end = new Date(session.end_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || now < start - 15 * 60_000 || now > end + 15 * 60_000) {
      throw new Error("join the consultation shortly before its scheduled time.");
    }

    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) throw new Error("secure video service is not configured.");
    const room = "tm_" + session.id.replace(/-/g, "");
    const authHeaders = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    // A deterministic, unguessable room ID makes concurrent access idempotent.
    const existing = await fetch(`https://api.daily.co/v1/rooms/${room}`, { headers: authHeaders });
    if (existing.status === 404) {
      const created = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({
          name: room, privacy: "private",
          properties: {
            exp: Math.floor((end + 30 * 60_000) / 1000),
            max_participants: 2,
            enable_recording: "off",
            enable_chat: false,
          },
        }),
      });
      // 400/409 can occur during an overlapping authorized join; re-check room below.
      if (!created.ok && created.status !== 400 && created.status !== 409) {
        throw new Error("unable to create a secure consultation room.");
      }
    } else if (!existing.ok) {
      throw new Error("unable to verify consultation room.");
    }

    const roomResponse = await fetch(`https://api.daily.co/v1/rooms/${room}`, { headers: authHeaders });
    if (!roomResponse.ok) throw new Error("consultation room unavailable.");
    const details = await roomResponse.json() as { url?: string };
    if (!details.url || !details.url.startsWith("https://")) throw new Error("invalid consultation room.");

    const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({
        properties: {
          room_name: room, is_owner: provider,
          exp: Math.floor(Math.min(end + 15 * 60_000, now + 60 * 60_000) / 1000),
          user_id: user.id, user_name: provider ? "Clinic professional" : "Client",
          enable_recording: "off",
        },
      }),
    });
    if (!tokenResponse.ok) throw new Error("unable to authorize your video consultation.");
    const token = await tokenResponse.json() as { token?: string };
    if (!token.token) throw new Error("invalid consultation authorization.");
    return { url: details.url, token: token.token, isProvider: provider };
  });
