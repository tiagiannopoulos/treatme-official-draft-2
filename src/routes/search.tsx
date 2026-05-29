import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "search · treatme" }, { name: "description", content: "find clinics and providers." }] }),
  component: () => (
    <div className="px-6 pt-10 text-center">
      <div className="mx-auto size-14 rounded-full bg-ink text-cream grid place-items-center"><Search className="size-6" /></div>
      <h1 className="brand-display text-[28px] mt-4">search — coming soon<span className="text-hot">.</span></h1>
      <p className="text-ink-mute text-[14px] mt-2">in the meantime, start with a scan and we'll match you.</p>
    </div>
  ),
});
