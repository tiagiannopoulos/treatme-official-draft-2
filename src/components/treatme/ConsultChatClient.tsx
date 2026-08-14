import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AnalysisFooter } from "@/components/treatme/AnalysisFooter";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { usePatient } from "@/lib/patient-store";
import { toConcernRows, SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";
import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { DEFAULT_MATCH_CENTER, treatmentMatchQuery } from "@/lib/treatment-match";
import {
  EMPTY_EXTRACTED,
  callConsultTurn,
  createConsultChat,
  mergeExtracted,
  persistConsultTurn,
  scanSummary,
  syncExtractedToProfile,
  type ConsultExtracted,
  type ConsultMessage,
  type ConsultStage,
} from "@/lib/consult-chat";

/**
 * the consult chat: a guided conversation. every treatme question comes with
 * 2 to 4 chips (the fast path) and the text input stays live (the escape
 * hatch). one question per message.
 */

export function ConsultChatClient({ treatmentSlug }: { treatmentSlug?: string } = {}) {
  const { result, analysis } = useScan();
  const { profile } = usePatient();

  const [messages, setMessages] = useState<ConsultMessage[]>([]);
  const [extracted, setExtracted] = useState<ConsultExtracted>(EMPTY_EXTRACTED);
  const [stage, setStage] = useState<ConsultStage>("intake");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const chatIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const rows = useMemo(() => (result ? toConcernRows(result) : []), [result]);
  const summary = useMemo(
    () => scanSummary(rows, analysis?.skinType ?? null, analysis?.fitzpatrick ?? null),
    [rows, analysis],
  );

  const known = useMemo<Partial<ConsultExtracted>>(
    () => ({
      ...extracted,
      budget: extracted.budget ?? profile.budget,
      downtime: extracted.downtime ?? profile.downtime,
      provider_preference: extracted.provider_preference ?? profile.providerPreference,
      primary_concern: extracted.primary_concern ?? profile.workingOn[0] ?? null,
    }),
    [extracted, profile],
  );

  const last = messages[messages.length - 1];
  const chips = !busy && last?.role === "assistant" ? (last.chips ?? []) : [];

  const runTurn = async (history: ConsultMessage[]) => {
    setBusy(true);
    setError(null);
    try {
      const turn = await callConsultTurn({
        messages: history.map((m) => ({ role: m.role, text: m.text })),
        scanSummary: summary,
        known,
        treatmentSlug,
      });

      const nextExtracted = mergeExtracted(extracted, turn.extracted);
      const nextMessages: ConsultMessage[] = [
        ...history,
        {
          role: "assistant",
          text: turn.message,
          chips: turn.chips,
          stage: turn.stage,
          treatmentSlugs: turn.treatment_slugs,
        },
      ];

      setExtracted(nextExtracted);
      setMessages(nextMessages);
      setStage(turn.stage);
      syncExtractedToProfile(nextExtracted);
      void persistConsultTurn({
        chatId: chatIdRef.current,
        messages: nextMessages,
        extracted: nextExtracted,
        stage: turn.stage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // open the chat: one row, then the first guided turn
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const { chatId } = await createConsultChat();
      chatIdRef.current = chatId;
      await runTurn([]);
      inputRef.current?.focus();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (text: string) => {
    const clean = text.trim().toLowerCase();
    if (!clean || busy || ended) return;
    const history: ConsultMessage[] = [...messages, { role: "user", text: clean }];
    setMessages(history);
    void runTurn(history).then(() => inputRef.current?.focus());
  };

  const onSubmit = (message: { text?: string }, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    send(message.text ?? "");
    form.reset();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-5.5rem)]" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <Link
          to="/scan/results"
          className="inline-flex items-center gap-1 text-[13px] font-semibold lowercase text-ink-mute"
        >
          <ArrowLeft className="size-4" /> back to results
        </Link>
        <h1 className="brand-eyebrow">consult</h1>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="px-4 pb-4 space-y-3">
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div key={index} className="flex justify-end">
                <p
                  className="max-w-[80%] rounded-3xl rounded-br-lg px-4 py-3 text-[14px] leading-snug lowercase text-ink"
                  style={{ backgroundColor: "#F8A1C6" }}
                >
                  {message.text}
                </p>
              </div>
            ) : (
              <div key={index} className="flex flex-col items-start gap-2">
                <p
                  className="max-w-[85%] rounded-3xl rounded-bl-lg border border-line px-4 py-3 text-[14px] leading-relaxed lowercase text-ink"
                  style={{ backgroundColor: message.stage === "escalate" ? "#FFEDB4" : "#FFFFFF" }}
                >
                  {message.text}
                </p>

                {message.stage === "summary" && (message.treatmentSlugs?.length ?? 0) > 0 && (
                  <SummaryCard slugs={message.treatmentSlugs ?? []} concerns={rows.map((r) => SCAN_CONCERN_LABEL[r.concern_key] ?? r.concern_key)} budget={profile.budget} />
                )}

                {message.stage === "escalate" && index === messages.length - 1 && !ended && (
                  <button
                    type="button"
                    onClick={() => setEnded(true)}
                    className="rounded-full bg-ink px-5 h-10 text-[13px] font-semibold lowercase text-white"
                  >
                    end chat
                  </button>
                )}
              </div>
            ),
          )}

          {busy && (
            <div className="flex justify-start">
              <Shimmer className="text-[14px] lowercase">thinking...</Shimmer>
            </div>
          )}

          {error && (
            <p className="text-[13px] lowercase text-ink-mute">{error}</p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {stage !== "escalate" && !ended && (
        <div className="px-4 pb-3 space-y-3">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => send(chip)}
                  className="rounded-full border border-ink/25 bg-white px-4 h-9 text-[13px] font-semibold lowercase text-ink"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <PromptInput onSubmit={onSubmit}>
            <PromptInputTextarea ref={inputRef} placeholder="or type it out" autoFocus />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={busy ? "submitted" : undefined} disabled={busy} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      )}

      <div className="px-4">
        <AnalysisFooter />
      </div>
    </div>
  );
}

function SummaryCard({
  slugs,
  concerns,
  budget,
}: {
  slugs: string[];
  concerns: string[];
  budget: ReturnType<typeof usePatient>["profile"]["budget"];
}) {
  const navigate = useNavigate();

  const { data: treatments = [] } = useQuery({
    queryKey: ["consult-summary-treatments", slugs.join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("treatments").select("slug, name, price_from").in("slug", slugs);
      return (data ?? []).map((t) => ({
        slug: t.slug,
        name: displayTreatmentName(t.name, t.slug),
        priceFrom: t.price_from === null ? null : Number(t.price_from),
      }));
    },
    enabled: slugs.length > 0,
    staleTime: 5 * 60_000,
  });

  const { data: match } = useQuery(
    treatmentMatchQuery(slugs[0] ?? "", {
      concerns: concerns.slice(0, 3),
      center: DEFAULT_MATCH_CENTER,
      radiusKm: 25,
      budget,
    }),
  );

  const providers = (match?.providers ?? []).slice(0, 3);

  return (
    <div className="w-full rounded-3xl border border-line bg-white p-4">
      <p className="brand-eyebrow">here's what i'd look at</p>

      <div className="mt-3 space-y-2">
        {slugs
          .map((slug) => treatments.find((t) => t.slug === slug))
          .filter((t): t is { slug: string; name: string; priceFrom: number | null } => Boolean(t))
          .map((t) => (
            <div key={t.slug} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold lowercase text-ink">{t.name}</p>
                {t.priceFrom !== null && (
                  <p className="text-[12px] lowercase text-ink-mute">from ${t.priceFrom}</p>
                )}
              </div>
              <PillButton onClick={() => navigate({ to: "/book/consult", search: { treatmentSlug: t.slug } })}>
                book consult
              </PillButton>
            </div>
          ))}
      </div>

      {providers.length > 0 && (
        <>
          <p className="brand-eyebrow mt-5">who i'd send you to</p>
          <div className="mt-3 space-y-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold lowercase leading-snug text-ink break-words">{p.name}</p>
                  <p className="text-[12px] lowercase leading-snug text-ink-mute break-words">
                    {p.clinicName}, {p.neighbourhood}
                  </p>
                </div>
                <PillButton
                  onClick={() =>
                    navigate({
                      to: "/book/consult",
                      search: { treatmentSlug: slugs[0], providerId: p.id, storefrontId: p.clinicId },
                    })
                  }
                >
                  book consult
                </PillButton>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
