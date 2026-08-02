import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Ctx = {
  slug: string | null;
  openSheet: (slug: string) => void;
  closeSheet: () => void;
};

const SheetCtx = createContext<Ctx | null>(null);

/** the quick sheet floats over whatever tab the user was on, so it lives above the router. */
export function TreatmentSheetProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const openSheet = useCallback((s: string) => setSlug(s), []);
  const closeSheet = useCallback(() => setSlug(null), []);
  return <SheetCtx.Provider value={{ slug, openSheet, closeSheet }}>{children}</SheetCtx.Provider>;
}

export function useTreatmentSheet() {
  const ctx = useContext(SheetCtx);
  if (!ctx) throw new Error("useTreatmentSheet must be used inside TreatmentSheetProvider");
  return ctx;
}
