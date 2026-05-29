import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { TREATMENTS } from "@/lib/treatments-data";

type ChatRequestBody = {
  messages?: unknown;
  scanContext?: string;
};

const SYSTEM_BASE = `you are treatme — the user's hottest friend with a medical degree.
voice: lowercase, warm, expert, confident, classy, never cheesy, never clinical-cold, no emojis.
you guide women through medical aesthetics: what each treatment does, what it improves, what to expect, downtime, and which one suits their concerns.
be specific. use brand-voice phrases ("your tx, matched", "skin that knows itself") sparingly.
when relevant, point to the user's available treatments by name and suggest they tap "book treatment" to see verified clinics nearby.
never diagnose serious medical conditions. if a user describes something that needs a doctor (suspicious moles, infection, severe acne), say "this one's a real-life derm visit, not a marketplace fix" and move on.

treatments you can reference (use plain names, not slugs):
${TREATMENTS.map((t) => `- ${t.name} — improves ${t.improves.join(", ")}; from $${t.priceFrom}`).join("\n")}
`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let parsed: ChatRequestBody;
        try {
          parsed = (await request.json()) as ChatRequestBody;
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const { messages, scanContext } = parsed;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const system =
          SYSTEM_BASE +
          (scanContext
            ? `\n\nuser's most recent skin scan (use this as context, reference it naturally):\n${scanContext}`
            : "");

        try {
          const result = streamText({
            model,
            system,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });
          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          console.error("chat error:", msg);
          const status = /\b429\b/.test(msg) ? 429 : /\b402\b/.test(msg) ? 402 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});
