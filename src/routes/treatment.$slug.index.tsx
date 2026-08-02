import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TreatmentSheet } from "@/components/treatme/TreatmentSheet";

export const Route = createFileRoute("/treatment/$slug/")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ");
    const title = `${pretty} · treatme`;
    const description = `what ${pretty} does, the downtime, the typical range, and the verified providers near you who offer it.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <p className="brand-eyebrow">something broke</p>
      <h1 className="brand-display text-[26px] mt-2">couldn't load this treatment.</h1>
      <p className="mt-2 text-[13px] text-ink-mute">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10 lowercase">no treatment here.</div>,
  component: QuickSheetRoute,
});

function QuickSheetRoute() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  function close() {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else navigate({ to: "/treatments" });
  }

  return <TreatmentSheet slug={slug} onClose={close} />;
}
