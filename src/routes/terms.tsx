import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Markdown } from "@/components/treatme/Markdown";
import { TERMS_MD } from "@/lib/legal-content";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "terms · treatme" },
      { name: "description", content: "the plain terms of using treatme for scans and bookings." },
      { property: "og:title", content: "terms · treatme" },
      { property: "og:description", content: "the plain terms of using treatme for scans and bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const router = useRouter();
  return (
    <div className="px-6 pt-6 pb-16">
      <button
        type="button"
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-mute lowercase"
      >
        <ChevronLeft className="size-4" /> back
      </button>
      <h1 className="brand-display text-[32px] mt-4">
        terms<span className="text-hot">.</span>
      </h1>
      <Markdown source={TERMS_MD} className="mt-5" />
    </div>
  );
}
