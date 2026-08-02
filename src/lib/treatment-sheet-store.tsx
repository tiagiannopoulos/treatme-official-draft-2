import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { TreatmentSheetHost } from "@/components/treatme/TreatmentSheet";

interface TreatmentSheetApi {
  /** open the treatment quick sheet from anywhere: a card pill, a roster row, a rail. */
  openTreatment: (slug: string) => void;
  closeTreatment: () => void;
}

const Ctx = createContext<TreatmentSheetApi | null>(null);

export function TreatmentSheetProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const openTreatment = useCallback((next: string) => setSlug(next), []);
  const closeTreatment = useCallback(() => setSlug(null), []);
  const api = useMemo(() => ({ openTreatment, closeTreatment }), [openTreatment, closeTreatment]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <TreatmentSheetHost slug={slug} onClose={closeTreatment} />
    </Ctx.Provider>
  );
}

/** safe outside the provider: returns a no-op so cards never crash in isolation. */
export function useTreatmentSheet(): TreatmentSheetApi {
  const ctx = useContext(Ctx);
  return ctx ?? { openTreatment: () => {}, closeTreatment: () => {} };
}
