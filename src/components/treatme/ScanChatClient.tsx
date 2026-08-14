import { useChat } from "@ai-sdk/react";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";
import { DefaultChatTransport } from "ai";
import { Link } from "@tanstack/react-router";
import { useMemo, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { CONCERN_LABEL } from "@/lib/skinAnalysis";
import { useScan } from "@/lib/scan-store";

export function ScanChatClient({ treatmentSlug }: { treatmentSlug?: string } = {}) {
  const { result, recommendations } = useScan();
  const analysis = result;

  const treatmentLine = treatmentSlug
    ? `the patient is asking about ${treatmentSlug.replace(/-/g, " ")} specifically.`
    : "";

  const scanContext = useMemo(() => {
    if (!result) return treatmentLine;

    const markerLines = [...result.concerns]
      .sort((a, b) => b.score - a.score)
      .map((c) => `- ${CONCERN_LABEL[c.key]}: ${Math.round(c.score)}/100`)
      .join("\n");

    return [`scan markers:\n${markerLines}`, `recommended treatments: ${recommendations.map((r) => r.name).join(", ")}`, treatmentLine]
      .filter(Boolean)
      .join("\n\n");
  }, [result, recommendations, treatmentLine]);


  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { scanContext },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const onSubmit = (message: { text?: string }, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = (message.text ?? "").trim();
    if (!text) return;
    sendMessage({ text });
    form.reset();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-5.5rem)]">
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <Link to="/scan/results" className="inline-flex items-center gap-1 text-[13px] font-semibold lowercase text-ink-mute">
          <ArrowLeft className="size-4" /> back to results
        </Link>
        <h1 className="brand-eyebrow">chat with treatme</h1>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="px-4 pb-4">
          {messages.length === 0 && (
            <ConversationEmptyState
              title="ask anything."
              description={analysis ? "i've got your scan in mind. ask about treatments, what they improve, where to start." : "ask about treatments — neuromodulators, fillers, lasers, peels, facials."}
            />
          )}

          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, index) => {
                  if (part.type !== "text") return null;

                  return message.role === "assistant" ? (
                    <p key={index} className="whitespace-pre-wrap leading-6 text-foreground">
                      {part.text}
                    </p>
                  ) : (
                    <p key={index} className="whitespace-pre-wrap leading-6">
                      {part.text}
                    </p>
                  );
                })}
              </MessageContent>
            </Message>
          ))}

          {isLoading && messages.at(-1)?.role === "user" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-4 pb-4">
        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea name="message" placeholder="ask about a treatment…" autoFocus />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
        <AnalysisFooter className="mt-3 text-center" />
      </div>
    </div>
  );
}