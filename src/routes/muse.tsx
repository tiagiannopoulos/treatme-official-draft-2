import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ScanProvider } from "@/features/muse/scan-store";
import museCss from "@/features/muse/muse.css?url";

export const Route = createFileRoute("/muse")({
  head: () => ({
    meta: [{ title: "advanced three-photo skin scan · treatme" }],
    links: [{ rel: "stylesheet", href: museCss }],
  }),
  component: MuseLayout,
});

function MuseLayout() {
  return (
    <ScanProvider>
      <div className="muse-experience tm-lower mx-auto w-full max-w-3xl px-5 pb-24">
        <Outlet />
      </div>
    </ScanProvider>
  );
}
