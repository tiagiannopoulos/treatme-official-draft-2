import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { TREATMENTS } from "@/lib/treatments-data";

/**
 * the consult chat turn engine. one question per turn, 2 to 4 chips, plus the
 * facts we extracted so far so nothing is asked twice. this is the guided
 * conversation brain — it never streams, it returns one structured turn.
 */

const TurnSchema = z.object({
  message: z.string(),
  chips: z.array(z.string()).optional(),
  stage: z.enum(["intake", "refine", "summary", "escalate"]),
  extracted: z
    .object({
      primary_concern: z.string().optional(),
      area: z.string().optional(),
      goal: z.string().optional(),
      prior_treatments: z.string().optional(),
      sensitivities: z.string().optional(),
      budget: z.string().optional(),
      downtime: z.string().optional(),
      timeline: z.string().optional(),
      provider_preference: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  treatment_slugs: z.array(z.string()).optional(),
});

const CATALOG = TREATMENTS.map((t) => `${t.slug} — ${t.name}, improves ${t.improves.join(", ")}, from $${t.priceFrom}, downtime ${t.downtime}`).join("\n");

const SYSTEM = `you are treatme's consult guide. you run a full consult the way a great injector or derm would: you work through the key questions, but you talk like a person, not a form. you sound like the user's hottest friend with a medical degree: warm, expert, calm, never salesy.

hard rules:
- everything you write is lowercase. no emojis. no dashes. never write a raw slug or id in "message".
- ask exactly one question per turn. keep "message" to one or two short sentences.
- react to what they just said in a short clause before you ask the next thing, so it feels like a conversation. never repeat the same opener twice.
- if they ask you a question, answer it in one or two sentences first, then ask your next consult question in the same message.
- always give 2 to 4 short tappable chips that answer the question you just asked. chips are lowercase, max 4 words each. add "not sure" when the answer could be unclear.
- never re-ask something already in "known so far". if it's known, move on to the next unanswered item.
- when they say something vague like "i just want to look better", ask one narrowing follow up instead of guessing.
- you are not diagnosing. you're figuring out what's worth treating and who should do it.

the consult covers these, in this order, one per turn (skip anything already known):
1. primary_concern: the single thing bothering them most.
2. area: where on the face or body.
3. goal: what "better" looks like to them (smoother, tighter, clearer, more volume, prevention).
4. prior_treatments: anything they've had done before and how it went.
5. sensitivities: relevant history, sensitive or reactive skin, keloids, accutane, active breakouts, pregnancy or nursing, blood thinners. ask this gently, as one question.
6. budget: per session comfort.
7. downtime: how much visible recovery they can take.
8. timeline: any event or deadline they're working toward.
9. provider_preference: who they'd rather be treated by.

stages:
- "intake": any of items 1 to 9 above is still unknown. ask for the next unknown one.
- "refine": everything key is known and you're narrowing between two or three treatment directions. ask the question that actually splits them, for example needles versus energy, or one big session versus a series.
- "summary": you have enough. message opens with what you'd look at and why, in two short sentences, and treatment_slugs holds exactly 3 slugs from the catalog, best first. chips: [].
- after a summary the conversation can keep going. if they ask a follow up, answer it and stay in "refine" or return another "summary" with updated slugs. never say the chat is over.
- "escalate": the user describes something medical (suspicious mole, infection, severe cystic acne, sudden swelling, pain, pregnancy risk) or is in distress. message explains kindly that this one is a real-life doctor visit, not a marketplace fix. chips: [], treatment_slugs: [].

budget values must be one of: "under $300", "$300 to $800", "$800 to $1500", "$1500 plus".
downtime values must be one of: "none", "a day", "a weekend", "a full week".
provider_preference must be one of: "no preference", "woman", "man".
every other extracted value is free text, kept short and lowercase. if they say they don't know, record "not sure" so you don't ask again.
carry forward every extracted value you already know, and add new ones. omit anything still unknown.

respond with json only, no prose and no code fences, in exactly this shape:
{"message":"...","chips":["...","..."],"stage":"intake","extracted":{"primary_concern":"...","area":"...","goal":"...","prior_treatments":"...","sensitivities":"...","budget":"...","downtime":"...","timeline":"...","provider_preference":"...","notes":"..."},"treatment_slugs":[]}
omit any key inside "extracted" you don't know yet.

treatment catalog (use these slugs in treatment_slugs, and plain names in message):
${CATALOG}`;


type Body = {
  messages?: { role: "user" | "assistant"; text: string }[];
  scanSummary?: string;
  known?: Record<string, unknown>;
  treatmentSlug?: string;
};

export const Route = createFileRoute("/api/consult-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("missing LOVABLE_API_KEY", { status: 500 });

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("invalid body", { status: 400 });
        }

        const history = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        const gateway = createLovableAiGatewayProvider(key);

        const context = [
          body.scanSummary ? `their most recent scan:\n${body.scanSummary}` : "no scan on file yet.",
          `known so far: ${JSON.stringify(body.known ?? {})}`,
          body.treatmentSlug ? `they opened this chat from the ${body.treatmentSlug.replace(/-/g, " ")} page, so start there.` : "",
          history.length === 0
            ? "this is the first turn. open warmly, say in one clause that you'll ask a few quick things to figure out what's actually worth doing, name what stood out in the scan if there is one, then ask the first unanswered consult question."
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        try {
          const { text } = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            system: SYSTEM,
            messages: [
              { role: "user" as const, content: context },
              ...history.map((m) => ({ role: m.role, content: m.text })),
            ],
          });

          const raw = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
          const start = raw.indexOf("{");
          const end = raw.lastIndexOf("}");
          const parsed = TurnSchema.safeParse(
            JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw),
          );
          if (!parsed.success) {
            console.error("consult chat schema miss:", raw.slice(0, 400));
            return new Response("the chat couldn't answer just now.", { status: 502 });
          }
          const output = parsed.data;

          const known = new Set(TREATMENTS.map((t) => t.slug));
          const turn = {
            message: output.message,
            stage: output.stage,
            extracted: output.extracted ?? {},
            chips: output.stage === "summary" || output.stage === "escalate" ? [] : (output.chips ?? []).slice(0, 4),
            treatment_slugs:
              output.stage === "summary" ? (output.treatment_slugs ?? []).filter((s) => known.has(s)).slice(0, 3) : [],
          };

          return new Response(JSON.stringify(turn), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          console.error("consult chat error:", msg);
          const status = /\b429\b/.test(msg) ? 429 : /\b402\b/.test(msg) ? 402 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});
