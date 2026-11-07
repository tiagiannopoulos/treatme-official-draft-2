import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { directoryQuery } from "@/lib/search-data";
import { getRecommendations } from "@/lib/recommendations";
import { verifiedClinicTreatmentSlugs } from "@/lib/clinic-scan-scope";
import { getPublicBrandedClinic } from "@/lib/consultations/request.functions";
import { useScan } from "@/features/muse/scan-store";
import {
  CONCERN_GROUPS,
  CONCERN_LABELS,
  bandFor,
  type AnalysisResult,
  type ConcernKey,
} from "@/features/muse/concerns";
import { ScoreBar, BandBadge } from "@/features/muse/components/ScoreBar";
import { FaceMap } from "@/features/muse/components/FaceMap";
import { getSupabase } from "@/features/muse/supabase";
import {
  detectLandmarksFromDataUrl,
  type Landmark,
} from "@/features/muse/face-landmarks";

export const Route = createFileRoute("/muse/report/$scanId")({
  component: ReportPage,
});

interface LoadedReport {
  result: AnalysisResult;
  frontPhoto: string | null;
  createdAt: string | null;
}

function ReportPage() {
  const { scanId } = Route.useParams();
  const navigate = useNavigate();
  const { result: liveResult, scanId: liveScanId, photos, frontLandmarks, clinicSlug } = useScan();
  const { data: directory } = useQuery({ ...directoryQuery, enabled: Boolean(clinicSlug) });
  // A user-provided clinic slug is never sufficient to activate a branded experience.
  const { data: activeClinic } = useQuery({
    queryKey: ["muse-active-clinic", clinicSlug],
    enabled: Boolean(clinicSlug),
    queryFn: () => getPublicBrandedClinic({ data: { slug: clinicSlug! } }),
    retry: 1,
    staleTime: 60_000,
  });
  const sourceClinic = activeClinic
    ? directory?.storefronts.find((s) => s.id === activeClinic.id)
    : undefined;
  const [loaded, setLoaded] = useState<LoadedReport | null>(null);
  const [missing, setMissing] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const {
    data: scanSuggestions,
    isPending: suggestionsPending,
    isError: suggestionsFailed,
  } = useQuery({
    queryKey: [
      "muse-scan-suggestions",
      scanId,
      loaded?.result.top_priorities,
      clinicSlug,
      sourceClinic?.id,
      sourceClinic?.listed.map((offer) => [offer.slug, offer.verified]),
    ],
    // A branded scan must never fall back to the unscoped general catalogue.
    enabled: Boolean(loaded) && (!clinicSlug || Boolean(sourceClinic)),
    queryFn: async () => {
      if (!loaded) return [];
      const allowedSlugs = clinicSlug
        ? verifiedClinicTreatmentSlugs(sourceClinic?.listed)
        : undefined;
      const result = await getRecommendations(loaded.result.top_priorities, [], allowedSlugs);
      return result.scanDriven;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (scanId === "latest" || (liveResult && liveScanId === scanId)) {
        if (liveResult) {
          setLoaded({ result: liveResult, frontPhoto: photos.front, createdAt: null });
        } else {
          setMissing(true);
        }
        return;
      }
      const sb = getSupabase();
      if (!sb) {
        setMissing(true);
        return;
      }
      const { data, error } = await sb.from("muse_scan_reports").select("*").eq("id", scanId).maybeSingle();
      if (cancelled || error || !data) {
        setMissing(true);
        return;
      }
      const concerns = Object.fromEntries(
        Object.entries(data.scores as Record<string, number>).map(([k, score]) => [
          k,
          { score, explanation: (data.explanations as Record<string, string>)[k] ?? "" },
        ]),
      );
      setLoaded({
        result: {
          concerns: concerns as AnalysisResult["concerns"],
          top_priorities: data.top_priorities as ConcernKey[],
          summary: data.summary as string,
          fitzpatrick: data.fitzpatrick ?? undefined,
          medical_flag: data.medical_flag ?? null,
        },
        // photos are intentionally not stored; the face overlay is available during the current scan session.
        frontPhoto: null,
        createdAt: data.created_at as string,
      });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [scanId, liveResult, liveScanId, photos.front]);

  // landmark pipeline: live store landmarks for the fresh scan, otherwise
  // detect on report mount; final fallback is the fractional zones.
  useEffect(() => {
    if (!loaded?.frontPhoto) return;
    if (scanId === "latest" || scanId === liveScanId) {
      setLandmarks(frontLandmarks);
      return;
    }
    let cancelled = false;
    setLandmarks(null);
    detectLandmarksFromDataUrl(loaded.frontPhoto).then((pts) => {
      if (!cancelled) setLandmarks(pts);
    });
    return () => {
      cancelled = true;
    };
  }, [loaded?.frontPhoto, scanId, liveScanId, frontLandmarks]);

  if (missing) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="tm-display text-4xl">no report here.</h1>
        <p className="mt-3 text-ink-soft">
          this report is not available. run a fresh scan to get one.
        </p>
        <Link to="/muse/scan" className="tm-btn-hot mt-6">
          start a scan
        </Link>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="tm-pulse mx-auto h-12 w-12 rounded-full bg-hot" />
        <p className="mt-4 text-ink-soft">loading your report...</p>
      </div>
    );
  }

  const { result } = loaded;
  const scores = Object.fromEntries(
    Object.entries(result.concerns).map(([k, v]) => [k, v.score]),
  ) as Record<ConcernKey, number>;
  const overall = Math.round(
    Object.values(scores).reduce((a, b) => a + b, 0) /
      Math.max(1, Object.values(scores).length),
  );

  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="tm-display text-4xl">here is what we see.</h1>
      {loaded.createdAt && (
        <p className="mt-2 text-sm text-ink-mute">
          scanned {new Date(loaded.createdAt).toLocaleDateString()}
        </p>
      )}

      <div className="tm-card mt-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="tm-display text-6xl tabular-nums">{overall}</p>
            <p className="mt-1 text-sm text-ink-mute">
              average across 16 markers
            </p>
          </div>
          <BandBadge score={overall} />
        </div>
        <div className="score-track mt-4">
          <div
            className="score-fill bg-hot"
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>

      <div className="tm-card mt-4 p-6">
        <p className="text-lg leading-relaxed">{result.summary}</p>
        {result.fitzpatrick && (
          <p className="mt-3 text-sm text-ink-mute">
            fitzpatrick type {result.fitzpatrick}
          </p>
        )}
      </div>

      {loaded.frontPhoto && (
        <div className="mt-6">
          <FaceMap
            photo={loaded.frontPhoto}
            scores={scores}
            landmarks={landmarks}
          />
        </div>
      )}

      <div className="mt-8">
        <h2 className="tm-display text-3xl">your top 3 priorities</h2>
        <div className="mt-4 grid gap-3">
          {result.top_priorities.map((key, i) => {
            const c = result.concerns[key];
            return (
              <div key={key} className="tm-card tm-rise p-5">
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    <span className="mr-2 text-hot">{i + 1}.</span>
                    {CONCERN_LABELS[key]}
                  </p>
                  <span className="text-sm font-semibold text-hot-deep">
                    {bandFor(c.score)} · {c.score}
                  </span>
                </div>
                <p className="mt-1.5 text-ink-soft">{c.explanation}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="tm-display text-3xl">the full picture</h2>
        {CONCERN_GROUPS.map((g) => (
          <div key={g.key} className="tm-card mt-4 p-6">
            <p className="text-sm font-semibold text-ink">{g.label}</p>
            <div className="mt-2 divide-y divide-line">
              {g.concerns.map((c) => {
                const key = c.key as ConcernKey;
                const v = result.concerns[key];
                return (
                  <ScoreBar
                    key={key}
                    score={v.score}
                    label={c.label}
                    blurb={v.explanation}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {result.medical_flag && (
        <div className="tm-card mt-6 border-l-4 border-l-hot p-5">
          <p className="font-bold text-hot-deep">worth a doctor's look.</p>
          <p className="mt-1 text-sm text-ink-soft">{result.medical_flag}</p>
        </div>
      )}

      <section className="mt-10" aria-label="educational scan suggestions">
        <h2 className="tm-display text-3xl">your scan suggestions</h2>
        <p className="mt-2 text-sm text-ink-mute">
          {clinicSlug
            ? sourceClinic
              ? `these are educational options offered by ${sourceClinic.name}, based on its clinic-confirmed service list.`
              : "this clinic link is not active or its services are unavailable. no other clinics are substituted."
            : "explore educational options across TreatMe, then find clinics that offer them."}
        </p>
        {(!clinicSlug || sourceClinic) && (
          <div className="mt-4 grid gap-3">
            {suggestionsPending && <p className="text-sm text-ink-mute">finding relevant services...</p>}
            {suggestionsFailed && <p className="text-sm text-ink-mute">suggestions are unavailable right now. your scan report is still saved.</p>}
            {!suggestionsPending && !suggestionsFailed && scanSuggestions?.length === 0 && (
              <p className="tm-card p-4 text-sm text-ink-soft">
                no matching services were found{clinicSlug ? " in this clinic's confirmed menu" : ""}.
                a licensed professional can discuss your options.
              </p>
            )}
            {scanSuggestions?.map((suggestion) => (
              <div key={suggestion.slug} className="tm-card p-5">
                <p className="font-semibold">{suggestion.name}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  relevant to your scan priorities. suitability requires professional assessment.
                </p>
                {sourceClinic ? (
                  <Link
                    className="mt-3 inline-block text-sm font-semibold underline"
                    to="/storefront/$id/request"
                    params={{ id: sourceClinic.id }}
                    search={{ treatment: suggestion.slug }}
                  >request a consultation</Link>
                ) : (
                  <Link
                    className="mt-3 inline-block text-sm font-semibold underline"
                    to="/search"
                    search={{ q: undefined, scope: undefined, treatment: suggestion.slug }}
                  >find clinics offering this</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 text-center">
        <button
          className="tm-btn-hot w-full sm:w-auto"
          disabled={Boolean(clinicSlug) && !sourceClinic}
          onClick={() =>
            sourceClinic
              ? navigate({ to: "/storefront/$id/request", params: { id: sourceClinic.id }, search: { treatment: undefined } })
              : navigate({ to: "/search", search: { q: undefined, scope: undefined, treatment: undefined } })
          }
        >
          {sourceClinic
            ? `request a consultation at ${sourceClinic.name}`
            : clinicSlug ? "clinic link unavailable" : "find an aesthetic clinic near me"}
        </button>
        <p className="mx-auto mt-4 max-w-md text-xs text-ink-mute">
          cosmetic and educational only. this is an estimate from photos, not a
          diagnosis. when in doubt, see a professional in person.
        </p>
      </div>
    </div>
  );
}
