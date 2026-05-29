import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SkinAnalysis } from "./skin-analysis";

const STORAGE_KEY = "treatme.scan.v1";

export type ScanState = {
  photoDataUrl: string | null;
  analysis: SkinAnalysis | null;
  startedAt: number | null;
};

type ScanContextValue = ScanState & {
  setPhoto: (dataUrl: string) => void;
  setAnalysis: (analysis: SkinAnalysis) => void;
  reset: () => void;
};

const ScanContext = createContext<ScanContextValue | null>(null);

const EMPTY: ScanState = { photoDataUrl: null, analysis: null, startedAt: null };

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScanState>(EMPTY);

  // hydrate from sessionStorage on mount (client only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [state]);

  const setPhoto = useCallback((dataUrl: string) => {
    setState({ photoDataUrl: dataUrl, analysis: null, startedAt: Date.now() });
  }, []);

  const setAnalysis = useCallback((analysis: SkinAnalysis) => {
    setState((prev) => ({ ...prev, analysis }));
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY);
    if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ScanContext.Provider value={{ ...state, setPhoto, setAnalysis, reset }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within <ScanProvider>");
  return ctx;
}
