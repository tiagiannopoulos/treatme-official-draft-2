import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTreatment, type Treatment } from "@/lib/treatments-data";
import { useTreatmentStory } from "@/lib/treatment-story-store";
import {
  StoryViewer,
  type StorySlide,
  type BeforeAfterItem,
  type StorySlideType,
  type StoryOverlay,
} from "@/components/treatme/StoryViewer";

type DbSlide = {
  id: string;
  slide_order: number;
  slide_type: StorySlideType;
  headline: string;
  body: string | null;
  detail_chips: string[];
  media_url: string | null;
  media_overlay: StoryOverlay;
};

const clean = (s: string | null | undefined) =>
  (s ?? "").replace(/—/g, ",").replace(/–/g, "-");

export function TreatmentStory() {
  const { slug, close } = useTreatmentStory();
  if (!slug) return null;
  return <TreatmentStoryInner slug={slug} onClose={close} />;
}

function TreatmentStoryInner({ slug, onClose }: { slug: string; onClose: () => void }) {
  const treatment = getTreatment(slug);
  const navigate = useNavigate();

  const { data: dbSlides = [], isLoading: slidesLoading } = useQuery({
    queryKey: ["treatment-story-slides", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_story_slides")
        .select("id, slide_order, slide_type, headline, body, detail_chips, media_url, media_overlay")
        .eq("treatment_slug", slug)
        .order("slide_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbSlide[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: beforeAfters = [] } = useQuery({
    queryKey: ["treatment-before-afters", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_before_afters")
        .select("id, before_url, after_url, caption, provider_name, weeks_between")
        .eq("treatment_slug", slug)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BeforeAfterItem[];
    },
    staleTime: 60_000,
  });

  const slides = useMemo<StorySlide[]>(() => {
    if (!treatment) return [];
    const filtered = dbSlides.filter((s) => {
      if (s.slide_type === "results") return beforeAfters.length > 0;
      return true;
    });
    const built: StorySlide[] = filtered.map((s) => ({
      id: s.id,
      slide_type: s.slide_type,
      headline: s.headline,
      body:
        s.slide_type === "pricing"
          ? `from $${treatment.priceFrom} at clinics near you.${s.body ? " " + clean(s.body) : ""}`
          : s.body,
      detail_chips: s.detail_chips ?? [],
      media_url: s.media_url ?? (s.slide_type === "hook" ? treatment.heroImage : null),
      media_overlay: s.media_overlay,
    }));
    if (beforeAfters.length > 0 && !built.some((s) => s.slide_type === "results")) {
      const pricingIdx = built.findIndex((s) => s.slide_type === "pricing");
      const insertAt = pricingIdx === -1 ? built.length : pricingIdx;
      built.splice(insertAt, 0, {
        id: "results-synth",
        slide_type: "results",
        headline: "real results.",
        body: null,
        detail_chips: [],
        media_url: null,
        media_overlay: "cream_scrim",
      });
    }
    return built;
  }, [treatment, dbSlides, beforeAfters]);

  if (!treatment) {
    return (
      <div className="fixed inset-0 z-[100] bg-cream grid place-items-center" onClick={onClose}>
        <p className="text-ink-mute lowercase">loading story...</p>
      </div>
    );
  }

  return (
    <StoryViewer
      slides={slides}
      beforeAfters={beforeAfters}
      loading={slidesLoading}
      onClose={onClose}
      cta={{
        defaultHeadline: "ready when you are.",
        defaultBody: "providers near you offer this.",
        primary: {
          label: "find providers",
          onClick: () => { onClose(); navigate({ to: "/treatments" }); },
        },
        secondary: {
          label: "scan first",
          onClick: () => { onClose(); navigate({ to: "/scan" }); },
        },
      }}
    />
  );
}

export type { Treatment };
