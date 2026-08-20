import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ReportPreview = lazy(() => import("@/components/report/ReportPreview"));

export const Route = createFileRoute("/report/$scanId/preview")({
  head: () => ({
    meta: [
      { title: "report preview · treatme" },
      { name: "description", content: "internal preview of the treatme skin analysis pdf report." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "report preview · treatme" },
      { property: "og:description", content: "internal preview of the treatme skin analysis pdf report." },
    ],
  }),
  component: ReportPreviewRoute,
});

function ReportPreviewRoute() {
  const { scanId } = Route.useParams();
  return (
    <main className="h-screen w-full bg-[#FCFBF7]">
      <h1 className="sr-only">report preview</h1>
      <ClientOnly fallback={<p className="p-6 text-sm lowercase">loading preview</p>}>
        <Suspense fallback={<p className="p-6 text-sm lowercase">loading preview</p>}>
          <ReportPreview scanId={scanId} />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
