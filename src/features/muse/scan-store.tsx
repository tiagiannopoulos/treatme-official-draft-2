import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AnalysisResult, ConcernKey } from "./concerns";
import type { Landmark } from "./face-landmarks";

export type PhotoAngle = "front" | "left" | "right";

interface ScanState {
  photos: Record<PhotoAngle, string | null>;
  /** normalized (0..1) facelandmarker points for the front photo, or null. */
  frontLandmarks: Landmark[] | null;
  ageRange: string | null;
  concerns: ConcernKey[];
  email: string;
  consent: boolean;
  result: AnalysisResult | null;
  scanId: string | null;
  setPhoto: (angle: PhotoAngle, dataUrl: string | null) => void;
  setFrontLandmarks: (pts: Landmark[] | null) => void;
  setAgeRange: (v: string | null) => void;
  toggleConcern: (k: ConcernKey) => void;
  setEmail: (v: string) => void;
  setConsent: (v: boolean) => void;
  setResult: (r: AnalysisResult | null, scanId: string | null) => void;
  reset: () => void;
}

const ScanContext = createContext<ScanState | null>(null);

const EMPTY = { front: null, left: null, right: null };

const DRAFT_KEY = "treatme.muse.scanDraft.v1";

interface ScanDraft {
  photos: Record<PhotoAngle, string | null>;
  frontLandmarks: Landmark[] | null;
  ageRange: string | null;
  concerns: ConcernKey[];
  consent: boolean;
}

/** load a saved draft (photos survive the sign-in redirect). null when none. */
function loadDraft(): ScanDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ScanDraft>;
    return {
      photos: {
        front: d.photos?.front ?? null,
        left: d.photos?.left ?? null,
        right: d.photos?.right ?? null,
      },
      frontLandmarks: d.frontLandmarks ?? null,
      ageRange: d.ageRange ?? null,
      concerns: Array.isArray(d.concerns) ? (d.concerns as ConcernKey[]) : [],
      consent: d.consent === true,
    };
  } catch {
    return null;
  }
}

/** save the draft. best effort — quota errors are swallowed. */
function saveDraft(d: ScanDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // storage full or unavailable: the flow still works, just without restore.
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function ScanProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<Record<PhotoAngle, string | null>>(() => {
    const d = loadDraft();
    return d ? d.photos : { ...EMPTY };
  });
  const [frontLandmarks, setFrontLandmarksState] = useState<Landmark[] | null>(() => {
    const d = loadDraft();
    return d ? d.frontLandmarks : null;
  });
  const [ageRange, setAgeRange] = useState<string | null>(() => loadDraft()?.ageRange ?? null);
  const [concerns, setConcerns] = useState<ConcernKey[]>(() => loadDraft()?.concerns ?? []);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(() => loadDraft()?.consent ?? false);
  const [result, setResultState] = useState<AnalysisResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  // persist the draft so a sign-in redirect never loses the scan in progress.
  useEffect(() => {
    saveDraft({ photos, frontLandmarks, ageRange, concerns, consent });
  }, [photos, frontLandmarks, ageRange, concerns, consent]);

  const setPhoto = useCallback(
    (angle: PhotoAngle, dataUrl: string | null) => {
      setPhotos((p) => ({ ...p, [angle]: dataUrl }));
      // landmarks belong to the specific front photo — clear on change.
      if (angle === "front") setFrontLandmarksState(null);
    },
    [],
  );

  const setFrontLandmarks = useCallback(
    (pts: Landmark[] | null) => setFrontLandmarksState(pts),
    [],
  );

  const toggleConcern = useCallback(
    (k: ConcernKey) =>
      setConcerns((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k])),
    [],
  );

  const setResult = useCallback((r: AnalysisResult | null, id: string | null) => {
    setResultState(r);
    setScanId(id);
    // the scan is done — the in-progress draft is no longer needed.
    if (r) clearDraft();
  }, []);

  const reset = useCallback(() => {
    setPhotos({ ...EMPTY });
    setFrontLandmarksState(null);
    setAgeRange(null);
    setConcerns([]);
    setEmail("");
    setConsent(false);
    setResultState(null);
    setScanId(null);
    clearDraft();
  }, []);

  const value = useMemo(
    () => ({
      photos,
      frontLandmarks,
      ageRange,
      concerns,
      email,
      consent,
      result,
      scanId,
      setPhoto,
      setFrontLandmarks,
      setAgeRange,
      toggleConcern,
      setEmail,
      setConsent,
      setResult,
      reset,
    }),
    [photos, frontLandmarks, ageRange, concerns, email, consent, result, scanId, setPhoto, setFrontLandmarks, setAgeRange, toggleConcern, setEmail, setConsent, setResult, reset],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanState {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used inside ScanProvider");
  return ctx;
}

export const AGE_RANGES = ["under 25", "25 to 34", "35 to 44", "45 to 54", "55 plus"];
