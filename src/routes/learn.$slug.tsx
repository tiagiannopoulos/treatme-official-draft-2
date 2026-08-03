import { createFileRoute } from "@tanstack/react-router";
import { EducationStoryPlayer } from "@/components/treatme/EducationStoryPlayer";

export const Route = createFileRoute("/learn/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ");
    const title = `${pretty} · treatme learn`;
    const description = `a short, plain language story on ${pretty}, built with clinicians and read in under a minute.`;
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
  component: LearnRoute,
});

function LearnRoute() {
  const { slug } = Route.useParams();
  return <EducationStoryPlayer slug={slug} />;
}
