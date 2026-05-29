import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { AnalysisSchema, FACE_ZONES } from "@/lib/skin-analysis";
import { TREATMENTS } from "@/lib/treatments-data";

const RequestBody = z.object({
  imageDataUrl: z.string().min(64).max(15_000_000),
});

const SYSTEM = `you are treatme's vision analysis engine — a medical aesthetics expert.
look at the user's face photo and return a structured skin assessment.

rules:
- write in lowercase, brand voice: warm, clinical, no jargon, no scare tactics, no emojis.
- for each marker, score 0–100 where higher = better (e.g. hydration 80 = well hydrated; pores 80 = small/tight; wrinkles 80 = few wrinkles).
- "zones" lists the 1–4 face regions where this concern is most visible, drawn from this fixed list: ${FACE_ZONES.join(
  ", ",
)}. empty array if the concern isn't notable.
- fitzpatrick: classify I–VI honestly.
- skinAge: integer estimate.
- blurb: ~3 short sentences. brand-voice. lead with the headline finding.
- strengths/weaknesses: 2–4 short phrases each.
- recommendedTreatments: pick 3–5 slugs from this exact list — return slugs only, no prose:
${TREATMENTS.map((t) => `  - ${t.slug} (${t.category})`).join("\n")}
`;

export const Route = createFileRoute("/api/analyze")({
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
        } catch (err) {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        try {
          const { object } = await generateObject({
            model,
            schema: AnalysisSchema,
            system: SYSTEM,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "analyze this face photo and return the full assessment as structured json.",
                  },
                  { type: "image", image: body.imageDataUrl },
                ],
              },
            ],
          });

          // sanitize recommended treatments to known slugs
          const validSlugs = new Set(TREATMENTS.map((t) => t.slug));
          object.recommendedTreatments = object.recommendedTreatments.filter((s) =>
            validSlugs.has(s),
          );
          if (object.recommendedTreatments.length < 2) {
            object.recommendedTreatments = ["hydrafacial", "skin-booster", "microneedling-rf"];
          }

          return Response.json({ analysis: object });
        } catch (err) {
          // bubble up rate limits / credit issues for the UI
          const msg = err instanceof Error ? err.message : "unknown error";
          const status =
            /\b429\b/.test(msg) ? 429 : /\b402\b/.test(msg) ? 402 : 500;
          console.error("analyze error:", msg);
          return Response.json(
            {
              error:
                status === 429
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
