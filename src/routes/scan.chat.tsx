import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useScan } from "@/lib/scan-store";
import { MARKER_KEYS, MARKER_LABEL } from "@/lib/skin-analysis";

export const Route = createFileRoute("/scan/chat")({
  head: () => ({
    meta: [
      { title: "chat with treatme" },
      { name: "description", content: "ask about treatments. like talking to a derm." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { analysis } = useScan();

  const scanContext = useMemo(() => {
    if (!analysis) return "";
    const markerLines = MARKER_KEYS.map(
      (k) => `- ${MARKER_LABEL[k]}: ${Math.round(analysis.markers[k].score)}/100 (${analysis.markers[k].note})`,
    ).join("\n");
    return `skin type: ${analysis.skinType}\nfitzpatrick: ${analysis.fitzpatrick}\nestimated skin age: ${analysis.skinAge}\n\nmarkers:\n${markerLines}\n\nstrengths: ${analysis.strengths.join("; ")}\nweaknesses: ${analysis.weaknesses.join("; ")}\nrecommended treatments: ${analysis.recommendedTreatments.join(", ")}`;
  }, [analysis]);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { scanContext },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const onSubmit = (message: { text?: string }, e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
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
        <span className="brand-eyebrow">chat with treatme</span>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="px-4 pb-4">
          {messages.length === 0 && (
            <ConversationEmptyState
              title="ask anything."
              description={analysis ? "i've got your scan in mind. ask about treatments, what they improve, where to start." : "ask about treatments — botox, fillers, lasers, peels, hydrafacials."}
            />
          )}

          {messages.map((m) => (
            <Message from={m.role} key={m.id}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant"
                      ? <MessageResponse key={i}>{part.text}</MessageResponse>
                      : <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                  }
                  return null;
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
      </div>
    </div>
  );
}
