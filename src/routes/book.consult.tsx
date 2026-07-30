import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/book/consult")({
  validateSearch: z.object({
    providerId: z.string().optional(),
    storefrontId: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "book a consult · treatme" },
      { name: "description", content: "consult booking with your treatme provider." },
      { property: "og:title", content: "book a consult · treatme" },
      { property: "og:description", content: "consult booking with your treatme provider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsultStub,
});

function ConsultStub() {
  const { providerId, storefrontId } = Route.useSearch();
  return (
    <div className="px-6 pt-16 pb-32">
      <p className="brand-eyebrow">consult</p>
      <h1 className="brand-display text-[30px] mt-2 lowercase">booking coming soon.</h1>
      <p className="mt-3 text-[14px] text-ink-soft lowercase leading-relaxed">
        we're wiring up live consult times. your provider and clinic are already held for this request.
      </p>
      <div className="mt-5 rounded-2xl border border-line p-4 text-[12px] text-ink-mute lowercase space-y-1">
        <p>provider: {providerId ?? "not set"}</p>
        <p>storefront: {storefrontId ?? "not set"}</p>
      </div>
      <Link to="/search" className="mt-6 inline-block text-[13px] text-hot lowercase">
        back to search
      </Link>
    </div>
  );
}
