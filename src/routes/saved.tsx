import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { SavedTreatments } from "@/components/treatme/profile/SavedTreatments";

export const Route = createFileRoute("/saved")({
  head: () => {
    const title = "saved treatments | treatme";
    const description =
      "every treatment you saved on treatme, with starting prices and a tap through to the full treatment story.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "/saved" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: "/saved" }],
    };
  },
  component: SavedPage,
});

function SavedPage() {
  return (
    <div className="min-h-dvh px-6 pb-16 pt-5">
      <Link
        to="/profile"
        aria-label="back to profile"
        className="grid size-9 place-items-center rounded-full border border-line bg-card"
      >
        <ArrowLeft className="size-4 text-ink" strokeWidth={2} />
      </Link>

      <h1 className="mt-4 text-[26px] font-semibold lowercase leading-tight text-ink">
        saved treatments
      </h1>
      <p className="mt-1 text-[13px] lowercase text-ink-mute">
        swipe a row or long press it to remove.
      </p>

      <div className="mt-5">
        <SavedTreatments hideHeading />
      </div>
    </div>
  );
}
