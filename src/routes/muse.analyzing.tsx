import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useScan, AGE_RANGES } from "@/features/muse/scan-store";
import { CONCERN_GROUPS, type ConcernKey } from "@/features/muse/concerns";
import { getSupabase, isSupabaseConfigured } from "@/features/muse/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/muse/analyzing")({
  component: AnalyzingPage,
});

const STAGES = [
  "reading texture and clarity...",
  "mapping tone and pigment...",
  "checking structure and firmness...",
  "looking closely at the eye area...",
  "building your report...",
];

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, data] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

function StageRow({
  done,
  active,
  label,
  progress,
  sub,
}: {
  done: boolean;
  active: boolean;
  label: string;
  progress: number; // 0..100
  sub: string | null;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
          done ? "bg-hot text-white" : "bg-mist text-ink-mute"
        } ${!done && active ? "tm-pulse" : ""}`}
        aria-hidden
      >
        {done ? "✓" : active ? "…" : "·"}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${done ? "text-ink" : "text-ink-soft"}`}>
          {label}
        </p>
        {sub && <p className="mt-0.5 text-sm text-ink-mute">{sub}</p>}
        <div className="score-track mt-2.5">
          <div
            className={`score-fill ${done ? "bg-hot" : "bg-hot/60"}`}
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function AnalyzingPage() {
  const navigate = useNavigate();
  const { openAuth } = useAuth();
  const {
    photos,
    ageRange,
    setAgeRange,
    concerns,
    toggleConcern,
    email,
    setEmail,
    consent,
    setResult,
  } = useScan();

  const [stage, setStage] = useState(0);
  const [reportBuilt, setReportBuilt] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // sign in is required before analysis can run.
  const [authState, setAuthState] = useState<"checking" | "ready" | "blocked">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) {
        // demo mode: accounts are not wired up yet, so scans run as guest.
        if (!cancelled) setAuthState("ready");
        return;
      }
      const sb = getSupabase();
      const { data } = await sb!.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setAuthState("blocked");
        return;
      }
      // prefill the report email from the signed-in account.
      setEmail(data.session.user.email ?? "");
      setAuthState("ready");
    })();
    return () => {
      cancelled = true;
    };
    // run once on mount: the gate decides before anything else renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      2600,
    );
    return () => clearInterval(t);
  }, []);

  // row 2 ("building a scan report…") starts once the micro-stages finish.
  useEffect(() => {
    if (stage === STAGES.length - 1 && !reportBuilt) {
      const t = setTimeout(() => setReportBuilt(true), 2600);
      return () => clearTimeout(t);
    }
  }, [stage, reportBuilt]);

  useEffect(() => {
    if (reportBuilt && !reportDone) {
      const t = setTimeout(() => setReportDone(true), 2400);
      return () => clearTimeout(t);
    }
  }, [reportBuilt, reportDone]);

  const analyzeDone = stage === STAGES.length - 1 && reportBuilt;
  const analyzeProgress = ((stage + 1) / STAGES.length) * 100;

  const ready =
    photos.front && photos.left && photos.right && consent && email.includes("@");
  const hasPhotos = Boolean(photos.front && photos.left && photos.right);

  async function runAnalysis() {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      const sb = getSupabase();
      let token: string | null = null;
      if (sb) {
        const { data } = await sb.auth.getSession();
        token = data.session?.access_token ?? null;
        if (!token) {
          setAuthState("blocked");
          setSending(false);
          return;
        }
      }

      const form = new FormData();
      form.append("front", dataUrlToImage(photos.front!), "front.jpg");
      form.append("left", dataUrlToImage(photos.left!), "left.jpg");
      form.append("right", dataUrlToImage(photos.right!), "right.jpg");
      form.append("ageRange", ageRange ?? "");
      form.append("concerns", JSON.stringify(concerns));
      form.append("email", email);

      const res = await fetch("/api/muse-analyze", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setError("analysis is unavailable right now. please try again later.");
      } else if (res.status === 429) {
        setError("you have used all 5 free scans for today. come back tomorrow.");
      } else if (res.status === 401) {
        // session did not survive — route through sign in and come back.
        setAuthState("blocked");
        setSending(false);
        return;
      } else if (!res.ok) {
        setError(body.detail || body.error || "the scan could not be completed. please try again.");
      } else {
        setResult(body.result, body.scan_id);
        navigate({ to: "/muse/report/$scanId", params: { scanId: body.scan_id ?? "latest" } });
        return;
      }
    } catch {
      setError("something went wrong sending your photos. check your connection and try again.");
    }
    setSending(false);
  }

  if (authState === "checking") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-ink-soft">getting things ready…</p>
      </div>
    );
  }

  if (authState === "blocked") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="tm-display text-4xl">sign in required.</h1>
        <p className="mt-3 text-ink-soft">
          sign in to save your report and continue the skin analysis.
        </p>
        <button className="tm-btn-hot mt-6" onClick={() => openAuth({ reason: "sign in to continue your skin scan", onDone: () => setAuthState("ready") })}>
          sign in
        </button>
      </div>
    );
  }

  if (!hasPhotos) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="tm-display text-4xl">no photos yet.</h1>
        <p className="mt-3 text-ink-soft">
          the analysis needs your three scan photos first.
        </p>
        <button className="tm-btn-hot mt-6" onClick={() => navigate({ to: "/muse/scan" })}>
          take my photos
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="tm-display text-4xl">reading your skin.</h1>

      <div className="tm-card mt-6 overflow-hidden">
        <div className="relative bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos.front!}
            alt="your front scan photo"
            className="block aspect-[3/4] w-full object-cover"
          />
          <div className="tm-scan-grid" aria-hidden />
          <div className="tm-scan-sweep" aria-hidden />
        </div>
        <div className="px-6 py-2">
          <StageRow
            done={analyzeDone}
            active={!analyzeDone}
            label="analysing scan results…"
            progress={analyzeDone ? 100 : analyzeProgress}
            sub={
              analyzeDone
                ? null
                : `${STAGES[stage]} · stage ${stage + 1} of ${STAGES.length}`
            }
          />
          <div className="border-t border-line" />
          <StageRow
            done={reportDone}
            active={reportBuilt && !reportDone}
            label="building a scan report…"
            progress={reportDone ? 100 : reportBuilt ? 100 : 0}
            sub={null}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-mute">
        while you wait, tell us a little more. it sharpens your report.
      </p>

      <div className="mt-8">
        <h2 className="tm-display text-2xl">your age range</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGE_RANGES.map((r) => (
            <button
              key={r}
              className="tm-chip"
              data-active={ageRange === r}
              onClick={() => setAgeRange(ageRange === r ? null : r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="tm-display text-2xl">what bothers you most</h2>
        <p className="mt-1 text-sm text-ink-mute">tap all that apply.</p>
        {CONCERN_GROUPS.map((g) => (
          <div key={g.key} className="mt-4">
            <p className="text-sm font-semibold text-ink-mute">{g.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.concerns.map((c) => (
                <button
                  key={c.key}
                  className="tm-chip"
                  data-active={concerns.includes(c.key as ConcernKey)}
                  onClick={() => toggleConcern(c.key as ConcernKey)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="tm-display text-2xl">email for your saved report</h2>
        <p className="mt-1 text-sm text-ink-mute">
          your email identifies your saved report. the results open in treatme; no email is automatically sent.
        </p>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="tm-input mt-3"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-hot-soft p-4 text-sm font-medium text-hot-deep">
          {error}
        </p>
      )}

      <button
        onClick={runAnalysis}
        disabled={!ready || sending}
        className="tm-btn-hot mt-6 w-full"
      >
        {sending ? "analyzing..." : "get my report"}
      </button>
      {!email.includes("@") && (
        <p className="mt-2 text-center text-sm text-ink-mute">
          add your email above to unlock the button.
        </p>
      )}
    </div>
  );
}

function dataUrlToImage(dataUrl: string, name: string): File {
  return dataUrlToFile(dataUrl, name);
}
