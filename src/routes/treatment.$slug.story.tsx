import { createFileRoute } from "@tanstack/react-router";
import { TreatmentStoryPlayer } from "@/components/treatme/TreatmentStoryPlayer";

export const Route = createFileRoute("/treatment/$slug/story")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ");
    const title = `${pretty} story · treatme`;
    const description = `what ${pretty} actually is, who it suits, the downtime and the range, then the providers near you who do it.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <p className="brand-eyebrow">something broke</p>
      <h1 className="brand-display text-[26px] mt-2">couldn't load this story.</h1>
      <p className="mt-2 text-[13px] text-ink-mute">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10 lowercase">no story here.</div>,
  component: StoryRoute,
});

function StoryRoute() {
  const { slug } = Route.useParams();
  return <TreatmentStoryPlayer slug={slug} />;
}
