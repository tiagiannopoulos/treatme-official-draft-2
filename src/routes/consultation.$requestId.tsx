import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getConsultationVideoAccess } from "@/lib/consultation-video.functions";

type Frame = { join: (args: {url:string;token:string}) => Promise<unknown>; destroy: () => void };
type DailyApi = { createFrame: (container: HTMLElement, opts: Record<string, unknown>) => Frame };
declare global { interface Window { DailyIframe?: DailyApi; Daily?: DailyApi; } }

export const Route = createFileRoute("/consultation/$requestId")({
  component: ConsultationPage,
});

function currentDaily(): DailyApi | undefined { return window.DailyIframe ?? window.Daily; }
function loadDailyJs(): Promise<DailyApi> {
  if (currentDaily()) return Promise.resolve(currentDaily()!);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-treatme-daily]');
    if (existing) {
      existing.addEventListener("load", () => currentDaily() ? resolve(currentDaily()!) : reject(new Error("video SDK unavailable")), { once: true });
      existing.addEventListener("error", () => reject(new Error("video SDK unavailable")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@daily-co/daily-js@0.94.0";
    script.crossOrigin = "anonymous";
    script.dataset.treatmeDaily = "true";
    script.onload = () => currentDaily() ? resolve(currentDaily()!) : reject(new Error("video SDK unavailable"));
    script.onerror = () => reject(new Error("video SDK unavailable"));
    document.head.appendChild(script);
  });
}
function ConsultationPage() {
  const { requestId } = Route.useParams();
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<Frame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  async function join() {
    if (loading || joined) return;
    setLoading(true); setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("sign in to your TreatMe account to join.");
      const access = await getConsultationVideoAccess({ data: {
        accessToken: data.session.access_token, requestId,
      } });
      if (!container.current) throw new Error("video container unavailable");
      const Daily = await loadDailyJs();
      const call = Daily.createFrame(container.current, {
        iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "16px" },
        showLeaveButton: true,
      });
      frame.current = call;
      await call.join({ url: access.url, token: access.token });
      setJoined(true);
    } catch (e) { setError(e instanceof Error ? e.message : "unable to join consultation."); }
    finally { setLoading(false); }
  }
  useEffect(() => () => { frame.current?.destroy(); frame.current = null; }, []);
  return (
    <main className="mx-auto max-w-3xl px-5 pb-28 pt-8">
      <p className="brand-eyebrow">private TreatMe appointment</p>
      <h1 className="brand-display mt-3 text-3xl">virtual skin consultation.</h1>
      <p className="mt-3 text-sm text-ink/65">
        Your appointment must be confirmed and paid before joining. Only the booked client and the verified clinic can enter.
      </p>
      <div className="mt-6 min-h-[320px] overflow-hidden rounded-2xl bg-ink" ref={container}
        style={{ height: "min(70vh, 580px)" }}>
        {!joined && <div className="flex h-full items-center justify-center text-white/60">camera preview appears when you join</div>}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 p-3 text-sm">{error}</p>}
      {!joined && <button type="button" disabled={loading} onClick={() => void join()}
        className="mt-5 w-full rounded-full bg-ink px-6 py-4 font-semibold text-white disabled:opacity-50">
        {loading ? "connecting securely..." : "join consultation"}
      </button>}
      {joined && <button type="button" className="mt-4 rounded-full border px-5 py-2 text-sm"
        onClick={() => { frame.current?.destroy(); frame.current = null; setJoined(false); }}>leave consultation</button>}
      <p className="mt-4 text-xs text-ink/50">Video calls are not recorded by TreatMe. Clinical care remains the responsibility of the clinic.</p>
      <Link to="/profile" className="mt-5 inline-block text-sm underline">back to profile</Link>
    </main>
  );
}
