import { createFileRoute, Link } from "@tanstack/react-router";
import { TREATMENTS } from "@/lib/treatments-data";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/treatments/")({
  head: () => ({
    meta: [
      { title: "treatments · treatme" },
      { name: "description", content: "the treatment library. learn what each one actually does." },
    ],
  }),
  component: TreatmentsPage,
});

function TreatmentsPage() {
  return (
    <div className="px-6 pt-6">
      <p className="brand-eyebrow">the menu</p>
      <h1 className="brand-display text-[36px] mt-2 text-balance">treatment library<span className="text-hot">.</span></h1>
      <p className="mt-3 text-ink-mute text-[14px]">every treatment, plain language, before you book.</p>

      <div className="mt-6 flex flex-col gap-3">
        {TREATMENTS.map((t) => (
          <Link key={t.slug} to="/treatments/$slug" params={{ slug: t.slug }} className="rounded-2xl bg-card border border-line p-4 flex items-center justify-between hover:border-ink/40 transition">
            <div className="pr-3">
              <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">{t.category}</p>
              <p className="font-bold text-[16px] mt-1">{t.name}</p>
              <p className="text-[12px] text-ink-mute mt-1">from ${t.priceFrom}</p>
            </div>
            <ArrowRight className="size-5 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
