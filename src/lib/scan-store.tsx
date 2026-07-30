import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SkinAnalysis } from "./skin-analysis";
import type { ScanResult } from "./skinAnalysis";
import type { Recommendation } from "./recommendations";

const STORAGE_KEY = "treatme.scan.v1";

export type ScanState = {
  photoDataUrl: string | null;
  photoPath: string | null;
  analysis: SkinAnalysis | null;
  result: ScanResult | null;
  recommendations: Recommendation[];
  goals: string[];
  goalRecommendations: Recommendation[];
  startedAt: number | null;
};

type ScanContextValue = ScanState & {
  setPhoto: (dataUrl: string) => void;
  setPhotoPath: (path: string | null) => void;
  setAnalysis: (analysis: SkinAnalysis) => void;
  setGoals: (goals: string[]) => void;
  setResult: (
    result: ScanResult,
    recommendations: Recommendation[],
    goalRecommendations?: Recommendation[],
  ) => void;
  reset: () => void;
};

const ScanContext = createContext<ScanContextValue | null>(null);

const EMPTY: ScanState = {
  photoDataUrl: null,
  photoPath: null,
  analysis: null,
  result: null,
  recommendations: [],
  goals: [],
  goalRecommendations: [],
  startedAt: null,
};

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScanState>(EMPTY);

  // hydrate from sessionStorage on mount (client only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
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
    setState((prev) => ({ ...EMPTY, goals: prev.goals, photoDataUrl: dataUrl, startedAt: Date.now() }));
  }, []);

  const setPhotoPath = useCallback((path: string | null) => {
    setState((prev) => ({ ...prev, photoPath: path }));
  }, []);

  const setAnalysis = useCallback((analysis: SkinAnalysis) => {
    setState((prev) => ({ ...prev, analysis }));
  }, []);

  const setGoals = useCallback((goals: string[]) => {
    setState((prev) => ({ ...prev, goals }));
  }, []);

  const setResult = useCallback(
    (
      result: ScanResult,
      recommendations: Recommendation[],
      goalRecommendations: Recommendation[] = [],
    ) => {
      setState((prev) => ({ ...prev, result, recommendations, goalRecommendations }));
    },
    [],
  );

  const reset = useCallback(() => {
    setState(EMPTY);
    if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ScanContext.Provider
      value={{ ...state, setPhoto, setPhotoPath, setAnalysis, setGoals, setResult, reset }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within <ScanProvider>");
  return ctx;
}
