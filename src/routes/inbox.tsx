import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Inbox, LockKeyhole, RefreshCcw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { loadConsultationInbox } from "@/lib/consultations/request.functions";
import { directoryQuery } from "@/lib/search-data";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/inbox")({
  component: ConsultationInbox,
  head: () => ({ meta: [{ title: "consultation inbox · treatme" }] }),
});
type InboxData = Awaited<ReturnType<typeof loadConsultationInbox>>;
function ConsultationInbox() {
  const { user, ready, openAuth } = useAuth();
  const { data: directory } = useQuery({ ...directoryQuery, enabled: Boolean(user) });
  const [result, setResult] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sign in again to view your inbox.");
      const next = await loadConsultationInbox({ data: { accessToken } });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your inbox.");
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (user) void load();
    else setResult(null);
    // Reload only when the logged-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <main className="mx-auto max-w-2xl px-5 pb-32 pt-9 lowercase">
      <div className="flex items-center gap-3">
        <Inbox className="size-7 text-hot"/>
        <div><h1 className="brand-display text-3xl">consultation inbox.</h1>
        <p className="mt-1 text-xs text-ink/50">private requests, never automatic bookings</p></div>
      </div>
      {!ready ? <p className="mt-8 text-sm">checking your account…</p> : !user ? (
        <div className="mt-8 rounded-2xl border p-6 text-center">
          <LockKeyhole className="mx-auto size-7"/>
          <p className="mt-3 text-sm">sign in with your authorized clinic or TreatMe admin account.</p>
          <button onClick={() => openAuth({ reason: "sign in to access your secure consultation inbox" })}
            className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">sign in</button>
        </div>
      ) : (
        <>
          <button onClick={() => void load()} disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm disabled:opacity-50">
            <RefreshCcw className="size-4"/> {loading ? "loading…" : "refresh requests"}
          </button>
          {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
          {result?.role === "none" && !loading &&
            <div className="mt-8 rounded-xl border p-5 text-sm text-ink/60">
              This account does not have an active, verified clinic membership or TreatMe admin access.
            </div>}
          {result && result.role !== "none" && (
            <div className="mt-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4"/>
                {result.role === "admin" ? "requests from non-partner clinics" : "your clinic's requests"}
              </div>
              <p className="mt-2 text-xs text-ink/50">{result.requests.length} request(s) • newest first</p>
              {result.requests.length === 0 && <p className="mt-6 text-sm text-ink/60">no pending requests to review.</p>}
              <div className="mt-5 grid gap-4">
                {result.requests.map((r) => {
                  const clinic = directory?.storefronts.find((s) => s.id === r.storefront_id);
                  return (
                    <article key={r.id} className="rounded-2xl border border-line bg-white p-5">
                      <div className="flex justify-between gap-4">
                        <div><p className="font-semibold">{clinic?.name ?? "selected clinic"}</p>
                          <p className="text-xs text-ink/50">{new Date(r.created_at ?? "").toLocaleString()}</p>
                        </div>
                        <span className="h-fit rounded-full bg-cream px-3 py-1 text-xs">{r.status || "new"}</span>
                      </div>
                      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm">
                        <div><dt className="text-xs text-ink/50">name</dt><dd>{r.full_name}</dd></div>
                        <div><dt className="text-xs text-ink/50">contact</dt><dd>{r.email} • {r.phone}</dd></div>
                        <div><dt className="text-xs text-ink/50">interest</dt><dd>{r.treatment_slug || "consultation"}</dd></div>
                        {r.notes && <div><dt className="text-xs text-ink/50">client note</dt><dd className="whitespace-pre-wrap">{r.notes}</dd></div>}
                      </dl>
                      <p className="mt-4 text-xs text-ink/45">request reference: {r.id}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      <p className="mt-8 text-xs text-ink/40">Access is verified on the server for every request. Do not share screenshots or records without consent.</p>
    </main>
  );
}
