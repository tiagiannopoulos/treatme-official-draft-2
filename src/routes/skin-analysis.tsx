import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ArrowRight } from "lucide-react";
import { PillButton } from "@/components/treatme/PillButton";
import { CONCERN_GROUPS, SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";

const FAQ = [
  {
    q: "what does a skin analysis measure?",
    a: "a skin analysis scores the visible state of your skin across concerns like pores, texture, pigmentation, fine lines, volume loss, hydration and the eye area. treatme maps 16 indicators onto a single photo.",
  },
  {
    q: "how accurate is skin analysis?",
    a: "accuracy depends on lighting, camera, angle and skin tone. phone-based scans give a useful estimate, not a clinical measurement. tools with published validation studies are more trustworthy than tools without.",
  },
  {
    q: "do skin analysis machines work?",
    a: "yes, within limits. in-clinic imaging uses controlled lighting, a fixed distance and multiple light spectra including uv to see below the surface. a phone camera reads the surface only.",
  },
  {
    q: "is treatme as good as visia?",
    a: "no. visia is the better instrument. it uses controlled lighting and uv imaging to detect sub-surface pigment that a phone cannot. treatme is free, instant and good for deciding what to ask a provider about.",
  },
  {
    q: "how do i do a skin analysis at home?",
    a: "stand in natural daylight facing a window, remove makeup, tie hair back, hold the phone at eye level, and do not use a filter.",
  },
  {
    q: "can a skin analysis detect skin cancer?",
    a: "no. a skin analysis cannot detect skin cancer, diagnose a rash or see below the surface. see a physician for anything medical.",
  },
];

export const Route = createFileRoute("/skin-analysis")({
  head: () => ({
    meta: [
      {
        title: "skin analysis: what it measures and how accurate it is | treatme",
      },
      {
        name: "description",
        content:
          "what a skin analysis actually measures, how accurate face scanning is, how it compares to visia in a clinic, and how to get one free.",
      },
      {
        property: "og:title",
        content: "skin analysis: what it measures and how accurate it is | treatme",
      },
      {
        property: "og:description",
        content:
          "what a skin analysis actually measures, how accurate face scanning is, how it compares to visia in a clinic, and how to get one free.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/skin-analysis" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: SkinAnalysisPage,
});

const COMPARE_ROWS: {
  label: string;
  visia: string;
  treatme: string;
}[] = [
  {
    label: "lighting",
    visia: "controlled, calibrated booth",
    treatme: "your phone in daylight",
  },
  {
    label: "distance",
    visia: "fixed chin and forehead rest",
    treatme: "you hold it at arm's length",
  },
  {
    label: "what it sees",
    visia: "surface + sub-surface pigment via uv",
    treatme: "surface only",
  },
  {
    label: "spectra",
    visia: "cross-polarized, parallel-polarized, uv",
    treatme: "one visible-light photo",
  },
  {
    label: "cost",
    visia: "paid, usually with a consult",
    treatme: "free",
  },
  {
    label: "how fast",
    visia: "book an appointment",
    treatme: "instant, on your phone",
  },
  {
    label: "best for",
    visia: "clinical baseline and tracking",
    treatme: "deciding what to ask a provider about",
  },
];

function SkinAnalysisPage() {
  const router = useRouter();

  return (
    <div className="px-6 pt-6 pb-20">
      <button
        type="button"
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-mute lowercase"
      >
        <ChevronLeft className="size-4" /> back
      </button>

      <h1 className="brand-display text-[34px] mt-5 lowercase">
        skin analysis<span className="text-bubblegum">.</span>
      </h1>

      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft max-w-[52ch]">
        a skin analysis looks at your face and scores what is actually there —
        pores, lines, pigment, hydration — so you stop guessing and start with
        the right treatment. treatme reads 16 indicators from one photo and
        maps each one onto your face.
      </p>

      <section className="mt-10">
        <h2 className="brand-display text-[22px] lowercase">
          what a skin analysis measures
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          face analysis, face mapping and face scanning all describe the same
          idea: reading the skin and turning what you see into numbers. treatme
          scores 16 indicators in four groups.
        </p>
        <div className="mt-5 space-y-5">
          {CONCERN_GROUPS.map((group) => (
            <div key={group.key}>
              <h3 className="text-[14px] font-bold lowercase text-ink">
                {group.label}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.concerns.map((key) => (
                  <span
                    key={key}
                    className="pill bg-bubblegum/30 text-ink text-[12px] font-semibold lowercase px-3 py-1.5"
                  >
                    {SCAN_CONCERN_LABEL[key]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="brand-display text-[22px] lowercase">
          how accurate is skin analysis
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          be honest with yourself about this. the score is only as good as the
          photo it came from. lighting changes what pigmentation and redness
          look like; the camera and its autofocus shift texture readings; the
          angle you hold the phone at moves where lines and volume sit; and
          darker skin tones are under-represented in the training data behind
          most tools, so their scores are less reliable. a tool that publishes
          validation studies — comparisons against clinician assessment or
          in-clinic imaging — is more trustworthy than one that does not.
          treatme does not claim an accuracy percentage. it is an estimate that
          points you toward the right concerns, not a clinical measurement.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="brand-display text-[22px] lowercase">
          do skin analysis machines work
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          yes, within limits. an in-clinic imaging device does several things a
          phone camera cannot. it holds the lighting constant, fixes the
          distance with a chin and forehead rest, and shoots under multiple
          light spectra — including uv — so it can see pigment sitting beneath
          the surface that is invisible in daylight. that controlled setup is
          why a clinic scan is the gold standard for a baseline. a phone reads
          the surface only, which is enough to decide what is worth asking a
          provider about but not enough to measure sub-surface change.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="brand-display text-[22px] lowercase">
          app vs in-clinic imaging like visia
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          visia is the better instrument, and saying so is what makes the rest of
          this page credible. it uses controlled lighting, uv imaging and
          cross-polarization to map sub-surface pigment a phone cannot reach.
          treatme trades that depth for something else: it is instant, free and
          good enough to figure out what to bring to a provider.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="bg-ink/5 lowercase">
                <th className="px-4 py-2.5 font-bold text-ink">visia (clinic)</th>
                <th className="px-4 py-2.5 font-bold text-ink">treatme (phone)</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 1 ? "bg-ink/[0.03]" : ""}
                >
                  <td className="px-4 py-3 align-top">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-mute">
                      {row.label}
                    </span>
                    <span className="mt-0.5 block lowercase text-ink">
                      {row.visia}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top lowercase text-ink">
                    {row.treatme}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="brand-display text-[22px] lowercase">
          how to do a skin analysis at home
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          the photo is the whole scan, so take it well. stand in natural daylight
          facing a window — not overhead bulbs, not a lamp to one side. remove
          makeup, tie hair back off your forehead, and hold the phone at eye
          level with your face straight on. do not use a filter. a clear,
          evenly lit photo reads far better than a flattering one.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="brand-display text-[22px] lowercase">
          what it can't tell you
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          a skin analysis cannot detect skin cancer. it cannot diagnose a rash
          or any skin condition, and it cannot see below the surface. the scores
          describe visible texture, tone and structure — nothing more. if
          anything looks unusual, grows, bleeds or changes fast, stop reading
          this page and see a physician.
        </p>
      </section>

      <div className="mt-12">
        <Link to="/scan">
          <PillButton icon={<ArrowRight className="size-4" />}>
            scan your skin free
          </PillButton>
        </Link>
      </div>

      <p className="mt-6 text-[12px] lowercase text-ink-mute max-w-[52ch]">
        this is an estimate, not a diagnosis.
      </p>
    </div>
  );
}
