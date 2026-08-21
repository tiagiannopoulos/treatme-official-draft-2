import { createFileRoute } from "@tanstack/react-router";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { AnalysisSchema, FACE_ZONES, MARKER_KEYS, type FaceZone } from "@/lib/skin-analysis";
import { TREATMENTS } from "@/lib/treatments-data";

const RequestBody = z.object({
  imageDataUrl: z.string().min(64).max(15_000_000),
});

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VALID_TREATMENT_SLUGS = new Set(TREATMENTS.map((t) => t.slug));
const DEFAULT_TREATMENTS = ["hydrafacial", "skin-booster", "microneedling-rf"];

const SYSTEM = `you are treatme's vision analysis engine — a medical aesthetics expert.
look at the user's face photo and return a structured skin assessment.

rules:
- write in lowercase, brand voice: warm, clinical, no jargon, no scare tactics, no emojis.
- if the image is a usable face photo but slightly imperfect, still return a best-effort assessment.
- only refuse if there is clearly no human face visible at all.
- for each marker, score 0–100 where higher = better (e.g. hydration 80 = well hydrated; pores 80 = small/tight; wrinkles 80 = few wrinkles).
- "zones" lists the 1–4 face regions where this concern is most visible, drawn from this fixed list: ${FACE_ZONES.join(
  ", ",
)}. empty array if the concern isn't notable.
- fitzpatrick: classify I–VI honestly.
- skinAge: integer estimate.
- blurb: ~3 short sentences. brand-voice. lead with the headline finding.
- strengths/weaknesses: 2–4 short phrases each.
- photoQuality: "good", "fair", or "poor" — "poor" only when lighting, blur, or angle genuinely made the read unreliable.
- medicalFlag: null almost always. a short lowercase phrase only when you see something that a doctor should look at rather than an aesthetics provider (e.g. an irregular mole, a lesion, suspected infection). never name a diagnosis.
- recommendedTreatments: pick 3–5 slugs from this exact list — return slugs only, no prose:
${TREATMENTS.map((t) => `  - ${t.slug} (${t.category})`).join("\n")}
`;

const JSON_FALLBACK_PROMPT = `analyze this face photo and return raw json only. no markdown, no code fences, no commentary.
required keys:
- skinType: one of oily, dry, combination, normal, sensitive
- fitzpatrick: one of I, II, III, IV, V, VI
- skinAge: integer
- markers: object with keys ${MARKER_KEYS.join(", ")} and for each key: { score: 0-100, note: short string, zones: array of ${FACE_ZONES.join(", ")} }
- blurb: 2-3 short sentences
- strengths: array of 2-4 short phrases
- weaknesses: array of 2-4 short phrases
- recommendedTreatments: array of 3-5 slugs from this list only: ${Array.from(VALID_TREATMENT_SLUGS).join(", ")}
- photoQuality: one of good, fair, poor
- medicalFlag: null, or a short lowercase phrase if something should be seen by a doctor`;

type Analysis = z.infer<typeof AnalysisSchema>;

const MAX_IMAGE_BYTES = 5_000_000;

/** decoded byte size of a base64 payload, without allocating it */
function base64Bytes(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) throw new Error("invalid_image_data_url");

  const mediaType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  const bytes = base64Bytes(base64);

  if (!SUPPORTED_IMAGE_TYPES.has(mediaType)) {
    throw new Error(`unsupported_media_type:${mediaType}`);
  }
  if (bytes > MAX_IMAGE_BYTES) {
    throw new Error(`image_too_large:${bytes}`);
  }

  return { mediaType, base64, bytes };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toStringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toNumberValue(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeZones(value: unknown): FaceZone[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((zone) => (typeof zone === "string" ? zone.trim() : ""))
    .filter((zone): zone is FaceZone => FACE_ZONES.includes(zone as FaceZone))
    .slice(0, 6);
}

function normalizeMarker(key: string, value: unknown) {
  const record = asRecord(value);
  return {
    score: Math.round(toNumberValue(record?.score, 62, 0, 100)),
    note: toStringValue(record?.note, `${key} looks fairly balanced in this photo.`).slice(0, 160),
    zones: normalizeZones(record?.zones),
  };
}

function normalizeStringList(value: unknown, fallback: string[]) {
  const next = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
    : fallback;

  return next.length > 0 ? next : fallback;
}

function sanitizeTreatments(value: unknown) {
  const filtered = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && VALID_TREATMENT_SLUGS.has(item))
    : [];

  return filtered.length >= 2 ? filtered.slice(0, 6) : DEFAULT_TREATMENTS;
}

function normalizeAnalysis(raw: unknown): Analysis {
  const record = asRecord(raw) ?? {};
  const markersRecord = asRecord(record.markers) ?? {};

  const markers = Object.fromEntries(
    MARKER_KEYS.map((key) => [key, normalizeMarker(key, markersRecord[key])]),
  );

  const strengths = normalizeStringList(record.strengths, ["balanced overall tone", "good baseline skin quality"]);
  const weaknesses = normalizeStringList(record.weaknesses, ["a little uneven texture", "some areas that would benefit from hydration"]);

  const analysis = {
    skinType: (["oily", "dry", "combination", "normal", "sensitive"] as const).includes(record.skinType as never)
      ? record.skinType
      : "combination",
    fitzpatrick: (["I", "II", "III", "IV", "V", "VI"] as const).includes(record.fitzpatrick as never)
      ? record.fitzpatrick
      : "III",
    skinAge: Math.round(toNumberValue(record.skinAge, 30, 10, 90)),
    markers,
    blurb: toStringValue(
      record.blurb,
      "your skin looks fairly balanced overall. this is a best-effort read from one photo, so use it as directional guidance. the clearest opportunities seem to be hydration, texture, and tone evenness.",
    ).slice(0, 600),
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    recommendedTreatments: sanitizeTreatments(record.recommendedTreatments),
    photoQuality: (["good", "fair", "poor"] as const).includes(record.photoQuality as never)
      ? record.photoQuality
      : "good",
    medicalFlag:
      typeof record.medicalFlag === "string" && record.medicalFlag.trim()
        ? record.medicalFlag.trim().slice(0, 240)
        : null,
  };

  return AnalysisSchema.parse(analysis);
}

function extractJson(text: string): unknown {
  const direct = text.trim();
  try {
    return JSON.parse(direct);
  } catch {
    // fall through
  }

  const fencedMatch = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1]);
  }

  const start = direct.indexOf("{");
  const end = direct.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(direct.slice(start, end + 1));
  }

  throw new Error("invalid_json_fallback_response");
}

async function runAnalysis(model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>, imageDataUrl: string) {
  const image = parseImageDataUrl(imageDataUrl);
  const userMessage = [
    {
      type: "text" as const,
      text: "analyze this face photo and return the full assessment as structured json.",
    },
    {
      type: "image" as const,
      image: image.base64,
      mediaType: image.mediaType,
    },
  ];

  try {
    const { object } = await generateObject({
      model,
      schema: AnalysisSchema,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });

    return normalizeAnalysis(object);
  } catch (structuredError) {
    const structuredMessage = structuredError instanceof Error ? structuredError.message : "unknown";
    console.error("analyze structured error:", structuredMessage);

    const { text } = await generateText({
      model,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...userMessage,
            { type: "text" as const, text: JSON_FALLBACK_PROMPT },
          ],
        },
      ],
    });

    return normalizeAnalysis(extractJson(text));
  }
}

export const Route = createFileRoute("/api/public/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json({ error: "Missing LOVABLE_API_KEY" }, { status: 500 });
        }

        let body: z.infer<typeof RequestBody>;
        try {
          body = RequestBody.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        try {
          const analysis = await runAnalysis(model, body.imageDataUrl);
          return Response.json({ analysis });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown error";
          const status =
            msg.startsWith("invalid_image_data_url") || msg.startsWith("unsupported_media_type")
              ? 400
              : /\b429\b/.test(msg)
                ? 429
                : /\b402\b/.test(msg)
                  ? 402
                  : 500;

          console.error("analyze error:", msg);

          return Response.json(
            {
              error:
                status === 400
                  ? "that photo format isn't supported. use a jpg, png, or webp."
                  : status === 429
                    ? "we're a little busy — try again in a moment"
                    : status === 402
                      ? "ai credits exhausted — add credits in workspace settings"
                      : "couldn't get a clear read. try again.",
            },
            { status },
          );
        }
      },
    },
  },
});
