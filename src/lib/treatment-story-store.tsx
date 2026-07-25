import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Ctx = {
  slug: string | null;
  open: (slug: string) => void;
  close: () => void;
};

const StoryCtx = createContext<Ctx | null>(null);

export function TreatmentStoryProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const open = useCallback((s: string) => setSlug(s), []);
  const close = useCallback(() => setSlug(null), []);
  return <StoryCtx.Provider value={{ slug, open, close }}>{children}</StoryCtx.Provider>;
}

export function useTreatmentStory() {
  const ctx = useContext(StoryCtx);
  if (!ctx) throw new Error("useTreatmentStory must be used inside TreatmentStoryProvider");
  return ctx;
}
