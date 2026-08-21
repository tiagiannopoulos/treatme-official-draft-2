import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FaceMap } from "@/components/treatme/FaceMap";
import { skinIndicatorsQuery } from "@/lib/skin-indicators";

/** internal reference sheet: every indicator at a clear score and a marked score. */
export const Route = createFileRoute("/dev/facemaps")({
  head: () => ({
    meta: [
      { title: "face map reference · treatme" },
      { name: "description", content: "internal sheet showing every skin indicator overlay." },
      { property: "og:title", content: "face map reference · treatme" },
      { property: "og:description", content: "internal sheet showing every skin indicator overlay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FaceMapsPage,
});

function FaceMapsPage() {
  const { data: indicators = [] } = useQuery(skinIndicatorsQuery());
  return (
    <div className="px-4 py-6">
      <h1 className="brand-display text-[24px] lowercase">face map reference</h1>
      <p className="text-[13px] text-ink/55 lowercase">left is score 90, right is score 40</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {indicators.map((i) => (
          <div key={i.slug}>
            <div className="grid grid-cols-2 gap-1">
              <FaceMap overlayKind={i.overlayKind} accent={i.accent} region={i.region} score={90} className="w-full" />
              <FaceMap overlayKind={i.overlayKind} accent={i.accent} region={i.region} score={40} className="w-full" />
            </div>
            <p className="mt-1 text-[12px] lowercase">
              {i.name} · {i.overlayKind}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
