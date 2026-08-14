import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ArrowRight } from "lucide-react";
import { PillButton } from "@/components/treatme/PillButton";
import { CONCERNS } from "@/lib/scan-concerns";

export const Route = createFileRoute("/skin-analysis")({
  head: () => ({
    meta: [
      { title: "free ai skin analysis — 16 concerns scored | treatme" },
      {
        name: "description",
        content:
          "what a skin analysis actually checks, how accurate phone-based ai scans are, and how treatme scores 16 concerns out of 100 from one photo. free, no card needed.",
      },
      {
        property: "og:title",
        content: "free ai skin analysis — 16 concerns scored | treatme",
      },
      {
        property: "og:description",
        content:
          "what a skin analysis actually checks, how accurate phone-based ai scans are, and how treatme scores 16 concerns out of 100 from one photo. free, no card needed.",
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
          mainEntity: [
            {
              "@type": "Question",
              name: "What is a skin analysis?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "A skin analysis looks at your face and scores each concern — hydration, pores, fine lines, wrinkles, pigmentation, texture, redness and more — so you can see what is actually going on and which treatments change it. treatme scores 16 concerns out of 100 from one photo.",
              },
            },
            {
              "@type": "Question",
              name: "Are skin analysis accurate?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "treatme's analysis is an estimate, not a diagnosis. it is built to surface the right concerns and match them to the right treatments, not to replace a dermatologist. for anything that looks unusual or changes quickly, see a clinician in person.",
              },
            },
            {
              "@type": "Question",
              name: "Do skin analysis machines work?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "In-clinic machines like visia use controlled lighting and multi-spectral imaging for high precision. treatme uses your phone camera plus ai vision models, which is fast and free but less controlled. the trade-off is convenience — good enough to point you at the right treatments, not a clinical-grade read.",
              },
            },
            {
              "@type": "Question",
              name: "What is visia skin analysis?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "visia is an in-clinic imaging system that photographs your skin under uv, polarised and plain light to map wrinkles, pores, uv spots, brown spots, redness and texture. treatme covers the same concern areas from a single phone photo, free and instant, with a visia-style overlay you can tap on your face.",
              },
            },
            {
              "@type": "Question",
              name: "How to do a skin analysis?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Take one straight-on photo in good, even light with no makeup and hair pulled back. treatme's ai maps your face, scores 16 concerns out of 100 and shows each one on your photo with the treatments that change it.",
              },
            },
            {
              "@type": "Question",
              name: "How often should a skin analysis be performed?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Every 4 to 6 weeks is enough to track changes from a new routine or treatment. seasons change your skin, so re-scan when the weather shifts or after a treatment cycle to see what moved.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: SkinAnalysisPage,
});

const FAQ = [
  {
    q: "what is a skin analysis",
    body: [
      "a skin analysis looks at your face and scores each concern — hydration, pores, fine lines, wrinkles, pigmentation, texture, redness and more — so you can see what is actually going on and which treatments change it.",
      "treatme scores 16 concerns out of 100 from one photo, then maps each one onto your face so you know exactly where it lives.",
    ],
  },
  {
    q: "are skin analysis accurate",
    body: [
      "treatme's analysis is an estimate, not a diagnosis. it is built to surface the right concerns and match them to the right treatments, not to replace a dermatologist.",
      "the scores are useful for direction — which concern to focus on first, which treatments to look at — not for a clinical verdict. if anything looks unusual or changes quickly, see a clinician in person.",
    ],
  },
  {
    q: "do skin analysis machines work",
    body: [
      "in-clinic machines like visia use controlled lighting and multi-spectral imaging for high precision. treatme uses your phone camera plus ai vision models, which is fast and free but less controlled.",
      "the trade-off is convenience: good enough to point you at the right treatments, not a clinical-grade read. think of it as triage before you book, not the appointment itself.",
    ],
  },
  {
    q: "what is visia skin analysis",
    body: [
      "visia is an in-clinic imaging system that photographs your skin under uv, polarised and plain light to map wrinkles, pores, uv spots, brown spots, redness and texture.",
      "treatme covers the same concern areas from a single phone photo — free and instant — with an overlay you can tap to see where each marker sits on your face. it is not a visia replacement, but it answers the same question: what is going on with my skin.",
    ],
  },
  {
    q: "how to do a skin analysis",
    body: [
      "take one straight-on photo in good, even light with no makeup and hair pulled back. treatme's ai maps your face, scores 16 concerns out of 100, and shows each one on your photo with the treatments that change it.",
      "the whole thing takes about a minute. no card, no upload to a public profile — your photo stays yours and you can delete it anytime.",
    ],
  },
  {
    q: "how often should a skin analysis be performed",
    body: [
      "every 4 to 6 weeks is enough to track changes from a new routine or treatment. seasons change your skin, so re-scan when the weather shifts or after a treatment cycle to see what moved.",
      "your past scans stay in your profile, so you can compare side by side instead of guessing whether the retinol is doing anything.",
    ],
  },
];

function SkinAnalysisPage() {
  const router = useRouter();
  const concernCount = CONCERNS.length;

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
        free ai skin analysis<span className="text-bubblegum">.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft max-w-[52ch]">
        a skin analysis is the step most people skip — looking at your own face
        and scoring what is actually there. treatme maps {concernCount} concerns
        onto your photo from a single shot, so you stop guessing and start with
        the right treatments.
      </p>

      <div className="mt-6">
        <Link to="/scan">
          <PillButton icon={<ArrowRight className="size-4" />}>
            scan my skin
          </PillButton>
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="brand-display text-[22px] lowercase">
          what treatme checks
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          one photo, scored across {concernCount} concerns in four groups:
          texture (pores, fine lines, wrinkles, texture), tone (pigmentation,
          dark spots, redness, evenness), volume (volume loss, under-eye,
          nasolabial folds, marionette lines), and moisture (hydration, oil
          balance, barrier, skin age). each gets a number out of 100 and a spot
          on your face.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {CONCERNS.slice(0, 8).map((c) => (
            <span
              key={c.key}
              className="pill bg-bubblegum/30 text-ink text-[12px] font-semibold lowercase px-3 py-2 text-center"
            >
              {c.label.toLowerCase()}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="brand-display text-[22px] lowercase">
          is it accurate, and is it a diagnosis
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          this is an estimate, not a diagnosis. the scores point you toward the
          right concerns and treatments — they are not a clinical verdict. for
          anything that looks unusual or changes fast, see a clinician.
        </p>
      </section>

      {FAQ.map((item) => (
        <section key={item.q} className="mt-10">
          <h2 className="brand-display text-[22px] lowercase">{item.q}</h2>
          <div className="mt-2 space-y-2.5">
            {item.body.map((p, i) => (
              <p
                key={i}
                className="text-[14px] leading-relaxed text-ink-mute max-w-[52ch]"
              >
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-12">
        <h2 className="brand-display text-[22px] lowercase">
          ready to see your skin
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mute max-w-[52ch]">
          one photo, {concernCount} concerns scored, and the treatments that
          change them — mapped to clinics in toronto. free, no card needed.
        </p>
        <div className="mt-5">
          <Link to="/scan">
            <PillButton fullWidth icon={<ArrowRight className="size-4" />}>
              start my skin analysis
            </PillButton>
          </Link>
        </div>
      </section>

      <p className="mt-10 text-[11px] leading-relaxed text-ink/45 max-w-[52ch]">
        this is an estimate, not a diagnosis. treatme does not provide medical
        advice. always consult a qualified clinician for concerns about your
        skin.
      </p>
    </div>
  );
}
