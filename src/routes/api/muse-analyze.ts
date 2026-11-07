import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  getUserFromRequest,
  isPremium,
  countScansToday,
  serviceClient,
  isDbConfigured,
} from "@/features/muse/supabase.server";
import {
  AnalysisResultSchema,
  CONCERN_KEYS,
  FREE_SCANS_PER_DAY,
  type AnalysisResult,
  type ConcernKey,
} from "@/features/muse/concerns";

/**
 * POST /api/muse-analyze
 * multipart form-data: front, left, right (image files), ageRange, concerns (json), email.
 * auth: Authorization: Bearer <supabase access token>. required — no guest scans.
 * signed-in users get scans saved to history.
 *
 * analysis engine: google gemini vision (GEMINI_API_KEY from env, server only).
 * never returns placeholder scores. when the analysis engine is unavailable
 * it returns 503 "analysis unavailable".
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

const MetaSchema = z.object({
  ageRange: z.string().max(20).optional().default(""),
  concerns: z.array(z.string()).max(16).optional().default([]),
  email: z.string().email().max(200),
});

const SYSTEM_PROMPT = `you are treatme's skin analysis engine, a medical aesthetics expert.
you look at face photos and return a structured cosmetic skin assessment. this is cosmetic and educational, never a medical diagnosis.

rules:
- write everything in lowercase. warm, clinical, plain english. no jargon, no scare tactics, no emojis, no em-dashes.
- score each of the 16 concerns from 0 to 100, where higher is better. for example pores 80 means small and tight, lines 80 means few visible lines, hydration 80 means well hydrated.
- "explanation" is one short plain sentence per concern, specific to what you see in the photos.
- "top_priorities" is the 1 to 3 concerns that would make the biggest visible difference if addressed. use exact concern keys.
- "summary" is 2 to 3 short sentences leading with the headline finding.
- "fitzpatrick": classify I to VI honestly from the photos when you can, otherwise omit it.
- "medical_flag": null almost always. a short lowercase phrase only if you see something a doctor should look at rather than an aesthetics provider, like an irregular mole or a lesion. never name a diagnosis.
- never use the word "poor". never estimate a skin age.
- analyze the front photo primarily. use the left and right photos for profile and symmetry context.`;

const concernObjectSchema = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", minimum: 0, maximum: 100 },
    explanation: { type: "STRING" },
  },
  required: ["score", "explanation"],
} as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    concerns: {
      type: "OBJECT",
      properties: Object.fromEntries(
        CONCERN_KEYS.map((k) => [k, concernObjectSchema]),
      ),
      required: [...CONCERN_KEYS],
    },
    top_priorities: {
      type: "ARRAY",
      items: { type: "STRING", enum: [...CONCERN_KEYS] },
      minItems: 1,
      maxItems: 3,
    },
    summary: { type: "STRING" },
    fitzpatrick: {
      type: "STRING",
      enum: ["I", "II", "III", "IV", "V", "VI"],
    },
    medical_flag: { type: "STRING", nullable: true },
  },
  required: ["concerns", "top_priorities", "summary"],
};

async function fileToInlineData(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  return {
    inlineData: {
      mimeType: file.type,
      data: buf.toString("base64"),
    },
  };
}

export const Route = createFileRoute("/api/muse-analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. engine availability. never fake a result.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return Response.json(
            {
              error: "analysis unavailable",
              detail:
                "the skin analysis engine is not configured yet. please try again later.",
            },
            { status: 503 },
          );
        }

        // 2. auth: required when supabase is configured. when it is not
        // configured (demo mode), guest scans are allowed.
        const user = await getUserFromRequest(request);
        const dbConfigured = isDbConfigured();
        if (!user && dbConfigured) {
          return Response.json(
            { error: "sign in required" },
            { status: 401 },
          );
        }

        // 3. daily scan limit (free tier: 5 scans a day).
        if (dbConfigured && user && !(await isPremium(user.id))) {
          const used = await countScansToday(user.id);
          if (used >= FREE_SCANS_PER_DAY) {
            return Response.json(
              {
                error: "daily limit reached",
                detail: `you have used all ${FREE_SCANS_PER_DAY} free scans for today.`,
                scans_remaining: 0,
              },
              { status: 429 },
            );
          }
        }

        // 4. validate input.
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "invalid form data" }, { status: 400 });
        }

        const photos: { angle: string; file: File }[] = [];
        for (const angle of ["front", "left", "right"]) {
          const file = form.get(angle);
          if (!(file instanceof File) || file.size === 0) {
            return Response.json(
              { error: `missing photo: ${angle}` },
              { status: 400 },
            );
          }
          if (!SUPPORTED_TYPES.has(file.type)) {
            return Response.json(
              { error: `unsupported image type for ${angle}. use jpeg, png or webp.` },
              { status: 400 },
            );
          }
          if (file.size > MAX_BYTES) {
            return Response.json(
              { error: `${angle} photo is too large. keep each photo under 5mb.` },
              { status: 400 },
            );
          }
          photos.push({ angle, file });
        }

        let concerns: string[] = [];
        try {
          concerns = JSON.parse((form.get("concerns") as string) || "[]");
        } catch {
          concerns = [];
        }
        const meta = MetaSchema.safeParse({
          ageRange: (form.get("ageRange") as string) || "",
          concerns,
          email: (form.get("email") as string) || "",
        });
        if (!meta.success) {
          return Response.json(
            { error: "a valid email is required to receive your report." },
            { status: 400 },
          );
        }

        // 5. call the vision model.
        let result: AnalysisResult;
        try {
          const imageParts = await Promise.all(
            photos.map((p) => fileToInlineData(p.file)),
          );
          const res = await fetch(GEMINI_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    ...imageParts,
                    {
                      text: `user context. age range: ${meta.data.ageRange || "not given"}. self-reported concerns: ${meta.data.concerns.join(", ") || "none"}. analyze the photos now.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
                temperature: 0.2,
                maxOutputTokens: 3000,
              },
            }),
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error("gemini api error:", res.status, errText.slice(0, 500));
            throw new Error(`gemini api returned ${res.status}`);
          }

          const body = (await res.json()) as {
            candidates?: Array<{
              finishReason?: string;
              content?: { parts?: Array<{ text?: string }> };
            }>;
            promptFeedback?: { blockReason?: string };
          };

          if (body.promptFeedback?.blockReason) {
            console.error("gemini blocked prompt:", body.promptFeedback.blockReason);
            throw new Error("prompt blocked");
          }

          const candidate = body.candidates?.[0];
          const text = candidate?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("")
            .trim();
          if (!text) {
            throw new Error("empty model response");
          }
          const parsed = JSON.parse(text);
          const validated = AnalysisResultSchema.safeParse(parsed);
          if (!validated.success) {
            console.error(
              "schema validation failed:",
              validated.error.issues.slice(0, 5),
            );
            throw new Error("schema validation failed");
          }
          result = validated.data;
        } catch (err) {
          console.error("analysis failed:", err);
          return Response.json(
            {
              error: "analysis failed",
              detail: "the scan could not be completed. please try again.",
            },
            { status: 502 },
          );
        }

        // 6. persist the scan when the database is configured.
        let scanId: string | null = null;
        if (dbConfigured) {
          const db = serviceClient();
          const scores = Object.fromEntries(
            CONCERN_KEYS.map((k) => [k, result.concerns[k as ConcernKey].score]),
          );
          const explanations = Object.fromEntries(
            CONCERN_KEYS.map((k) => [k, result.concerns[k as ConcernKey].explanation]),
          );
          const { data, error } = await db!
            .from("muse_scan_reports")
            .insert({
              user_id: user!.id,
              scores,
              explanations,
              top_priorities: result.top_priorities,
              summary: result.summary,
              fitzpatrick: result.fitzpatrick ?? null,
              medical_flag: result.medical_flag ?? null,
              email: meta.data.email,
              photo_count: photos.length,
            })
            .select("id")
            .single();
          if (error) {
            console.error("scan save failed:", error);
          } else {
            scanId = data.id;
          }
        }

        return Response.json({ scan_id: scanId, result });
      },
    },
  },
});
