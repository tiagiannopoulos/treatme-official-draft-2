import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { PillButton } from "@/components/treatme/PillButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "treatme — get treated." },
      { name: "description", content: "your tx, matched. scan your skin, see what's actually there, find verified providers nearby." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  return (
    <div className="px-6 pt-6">
      <p className="brand-eyebrow">menu · for you</p>

      <h1 className="brand-display text-[44px] mt-3 text-balance">
        let's see what your<br/>skin is asking for<span className="text-hot">.</span>
      </h1>


      <div className="mt-7 flex flex-col gap-3">
        <Link to="/scan">
          <PillButton fullWidth icon={<Sparkles className="size-[18px]" />}>scan me</PillButton>
        </Link>
        <Link to="/treatments">
          <PillButton fullWidth variant="outline">browse treatments</PillButton>
        </Link>
      </div>

      <section className="mt-10">
        <p className="brand-eyebrow">what's on the menu</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <CategoryCard tone="bubblegum" title="skin analysis" sub="see what's actually there." />
          <CategoryCard tone="butter" title="treatment discovery" sub="know what to do next." />
          <CategoryCard tone="mint" title="provider matching" sub="find the right hands." />
          <CategoryCard tone="cream" title="education" sub="learn the difference." />
        </div>
      </section>

      <section className="mt-10 rounded-2xl bg-ink text-cream p-6">
        <p className="brand-eyebrow text-cream/60">how it works</p>
        <h2 className="brand-display text-[28px] mt-2">get scanned,<br/>get treated.</h2>
        <ol className="mt-5 space-y-3 text-[14px] text-cream/85">
          <Step n="01" t="scan your face" d="one photo. good light. no makeup." />
          <Step n="02" t="read the result" d="13 markers + a clear blurb. tap any concern to see it on your face." />
          <Step n="03" t="book a 15-min consult" d="verified providers near you. first visit is always a free consult." />
        </ol>
        <Link to="/scan" className="mt-6 inline-flex items-center gap-1 text-hot font-semibold lowercase">
          start scan <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}

function CategoryCard({ tone, title, sub }: { tone: "bubblegum" | "butter" | "mint" | "cream"; title: string; sub: string }) {
  const bg = { bubblegum: "bg-bubblegum", butter: "bg-butter", mint: "bg-mint", cream: "bg-cream border border-line" }[tone];
  return (
    <div className={`rounded-2xl ${bg} p-4 h-32 flex flex-col justify-between`}>
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-ink/70">on the menu</span>
      <div>
        <p className="font-bold text-[15px] tracking-tight">{title}</p>
        <p className="text-[12px] text-ink/70">{sub}</p>
      </div>
    </div>
  );
}

function Step({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <li className="flex gap-3">
      <span className="text-hot font-bold text-[12px] tracking-widest pt-[2px]">{n}</span>
      <div>
        <p className="font-semibold text-cream">{t}</p>
        <p className="text-cream/65">{d}</p>
      </div>
    </li>
  );
}
