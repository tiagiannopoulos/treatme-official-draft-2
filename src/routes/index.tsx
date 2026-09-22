import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, FileText, MessageCircle, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => {
    const title = "treatme | understand your skin and explore your options";
    const description =
      "start with a photo-based skin review, save your personal report, and explore aesthetic treatments with an ai consultant.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://treatmeapp.com/" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: "https://treatmeapp.com/" }],
    };
  },
  component: ConsumerHome,
});

const steps = [
  {
    icon: Camera,
    title: "start with a photo",
    description: "follow the photo guide for a review of visible skin concerns.",
  },
  {
    icon: FileText,
    title: "understand your results",
    description: "explore your findings and download your personal pdf report.",
  },
  {
    icon: MessageCircle,
    title: "talk through your options",
    description:
      "ask the ai consultant about treatments, your priorities and questions for a provider.",
  },
];

function ConsumerHome() {
  const { user, ready } = useAuth();
  const latestScan = useQuery({
    queryKey: ["consumer-home-scan", user?.id ?? null],
    enabled: ready && Boolean(user),
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("scans")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("status", "complete")
        .not("result", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 pb-8 pt-6 space-y-8">
      <section className="rounded-[28px] bg-bubblegum/35 p-6 sm:p-8">
        <p className="brand-eyebrow">your skin. your choices.</p>
        <h1 className="brand-display mt-5 max-w-md text-[44px] sm:text-[56px]">
          a clearer place
          <br />
          to start<span className="text-hot">.</span>
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
          get to know your skin, understand your options, and decide what matters to you.
        </p>
        <Link
          to="/scan"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 font-semibold text-white sm:w-auto"
        >
          <Camera className="size-[18px]" aria-hidden="true" />
          {latestScan.data ? "start a new scan" : "start my skin scan"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
          photo-based ai estimates. lighting can affect results. a provider confirms treatment
          suitability.
        </p>
      </section>

      {user && (
        <section aria-label="your latest scan" aria-live="polite">
          {latestScan.isPending ? (
            <p className="text-[13px] text-ink-mute" role="status">
              checking your saved scans…
            </p>
          ) : latestScan.isError ? (
            <div className="rounded-2xl border border-line p-4">
              <p className="text-[13px] text-ink-soft">your saved scans couldn't load just now.</p>
              <button
                type="button"
                onClick={() => void latestScan.refetch()}
                disabled={latestScan.isFetching}
                className="mt-2 min-h-11 text-[13px] font-semibold underline underline-offset-4 disabled:opacity-50"
              >
                {latestScan.isFetching ? "loading…" : "try again"}
              </button>
            </div>
          ) : latestScan.data ? (
            <Link
              to="/scan/results"
              search={{ id: latestScan.data.id }}
              className="flex items-center gap-4 rounded-2xl border border-line p-5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-[15px]">pick up where you left off</h2>
                <p className="mt-1 text-[12px] text-ink-mute">
                  open your latest results and download your report
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          ) : null}
        </section>
      )}

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="brand-display text-[26px]">
          from photo to next steps
        </h2>
        <ol className="mt-5 space-y-5">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-butter/65">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold">
                  <span className="text-ink-mute">0{index + 1} / </span>
                  {title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl bg-mint/70 p-6">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5" aria-hidden="true" />
          <p className="brand-eyebrow">your ai consultant</p>
        </div>
        <h2 className="brand-display mt-4 text-[28px]">questions are a good start.</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          what does a treatment involve? how much downtime might it mean? talk through your goals,
          budget and previous experiences.
        </p>
        <Link
          to="/scan/chat"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold"
        >
          talk to the ai consultant <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <section className="divide-y divide-line rounded-2xl border border-line px-5">
        <Link to="/profile" className="flex min-h-20 items-center gap-3 py-4">
          <SlidersHorizontal className="size-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-[14px] font-semibold">your scans & preferences</h2>
            <p className="mt-1 text-[12px] text-ink-mute">
              saved results, your goals and what you're comfortable with
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
        <Link
          to="/treatments"
          className="flex min-h-16 items-center justify-between gap-3 py-4 text-[14px] font-semibold"
        >
          explore the treatment library{" "}
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
