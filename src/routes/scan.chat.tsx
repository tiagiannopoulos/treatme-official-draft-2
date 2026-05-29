import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ArrowLeft } from "lucide-react";

const ScanChatClient = lazy(() =>
  import("@/components/treatme/ScanChatClient").then((module) => ({
    default: module.ScanChatClient,
  })),
);

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
  return (
    <ClientOnly fallback={<ChatFallback />}>
      <Suspense fallback={<ChatFallback />}>
        <ScanChatClient />
      </Suspense>
    </ClientOnly>
  );
}

function ChatFallback() {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-5.5rem)]">
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <Link to="/scan/results" className="inline-flex items-center gap-1 text-[13px] font-semibold lowercase text-ink-mute">
          <ArrowLeft className="size-4" /> back to results
        </Link>
        <span className="brand-eyebrow">chat with treatme</span>
      </div>

      <div className="flex-1 px-6 py-8">
        <div className="rounded-3xl border border-line bg-card p-5">
          <p className="brand-eyebrow">loading</p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-mute">
            pulling in your chat.
          </p>
        </div>
      </div>
    </div>
  );
}
