import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, RefreshCcw, ShieldCheck, Building2, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { loadTreatMeWorkspace } from "@/lib/workspace.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "TreatMe · operations" }] }),
});
type Workspace = Awaited<ReturnType<typeof loadTreatMeWorkspace>>;
function AdminPage() {
  const { user, ready, openAuth } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Please sign in again.");
      setWorkspace(await loadTreatMeWorkspace({ data: { accessToken: data.session.access_token } }));
    } catch (err) {
      setWorkspace(null);
      setError(err instanceof Error ? err.message : "Unable to load operations.");
    } finally { setLoading(false); }
  }, [user]);
  useEffect(() => {
    if (user) void load();
    else setWorkspace(null);
  }, [user, load]);

  return <main className="mx-auto max-w-5xl px-5 pb-32 pt-9 lowercase">
    <div className="flex items-center gap-3"><ShieldCheck className="size-7 text-hot" />
      <div><h1 className="brand-display text-3xl">treatme operations.</h1>
        <p className="mt-1 text-sm text-ink/60">private admin and clinic workspace · staging preview</p></div>
    </div>
    {!ready ? <p className="mt-8 text-sm">checking access…</p> : !user ?
      <div className="mt-8 rounded-2xl border bg-white p-6">
        <LockKeyhole className="size-6" /><p className="mt-3 text-sm">sign in to your authorized account.</p>
        <button onClick={() => openAuth({ reason: "sign in to view your TreatMe workspace" })} className="mt-4 rounded-full bg-ink px-5 py-3 text-sm text-white">sign in</button>
      </div> : <>
        <button disabled={loading} onClick={() => void load()} className="mt-6 flex items-center gap-2 rounded-full border px-4 py-2 text-sm disabled:opacity-50">
          <RefreshCcw className="size-4" /> {loading ? "loading…" : "refresh workspace"}
        </button>
        {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
        {workspace?.role === "clinic" && <section className="mt-7 rounded-2xl border bg-white p-6">
          <Building2 className="size-6 text-hot" /><h2 className="mt-2 text-xl font-semibold">clinic workspace</h2>
          {workspace.partners.length === 0 ? <p className="mt-2 text-sm">no clinic membership linked to this account yet. submit a claim from your clinic listing.</p> :
            workspace.partners.map((p) => <div key={p.storefront_id} className="mt-4 rounded-xl bg-cream p-4 text-sm">
              <p>clinic reference: {p.storefront_id}</p>
              <p>verification: {p.verified ? "reviewed" : "pending"} · account: {p.status} · subscription: {p.subscription_status}</p>
              {p.active ? <Link to="/inbox" className="mt-3 inline-block font-semibold underline">open secure consultation inbox →</Link> :
                <p className="mt-2 text-ink/60">your branded link and client inbox remain locked until independent verification and activation.</p>}
            </div>)}
        </section>}
        {workspace?.role === "admin" && <>
          <div className="mt-7 grid gap-3 sm:grid-cols-4">
            <Metric label="claim submissions shown" value={workspace.claims.length} />
            <Metric label="verified active partners shown" value={workspace.activePartnerCount} />
            <Metric label="requests shown" value={workspace.requests.length} />
            <Metric label="failed notices shown" value={workspace.notices.filter((n) => n.delivery_status === "failed").length} />
          </div>
          <p className="mt-3 text-xs text-ink/50">counts reflect up to 100 most recent records per category, not platform-wide totals. No clinic is automatically verified here.</p>
          <section className="mt-8 rounded-2xl border bg-white p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><ClipboardList className="size-5" /> clinic claim review queue</h2>
            <p className="mt-2 text-xs text-ink/55">claims are unverified submissions, not proof of identity, credentials or ownership.</p>
            {workspace.claims.length === 0 ? <p className="mt-4 text-sm text-ink/60">no claims in this window.</p> :
              <div className="mt-4 grid gap-3">{workspace.claims.map((c) =>
                <article key={c.id} className="rounded-xl border p-4 text-sm">
                  <p className="font-semibold">{c.contact_name || "unnamed applicant"} · {c.role || "role not provided"}</p>
                  <p className="mt-1">{c.work_email} · {c.work_phone}</p>
                  <p className="mt-1 text-xs text-ink/50">clinic: {c.storefront_id} · submitted {c.created_at ? new Date(c.created_at).toLocaleDateString() : "unknown"}</p>
                  {c.note && <p className="mt-2 whitespace-pre-wrap text-ink/70">{c.note}</p>}
                  <p className="mt-2 text-xs text-ink/50">pending independent verification · no automatic activation</p>
                </article>)}</div>}
          </section>
          <section className="mt-7 rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-semibold">partner accounts</h2>
            <div className="mt-4 grid gap-3">{workspace.partners.map((p) =>
              <div key={p.storefront_id} className="rounded-xl border p-4 text-sm">
                <p className="font-semibold">clinic {p.storefront_id}</p>
                <p className="mt-1">verification: {p.verified_at ? "reviewed" : "pending"} · account: {p.status} · subscription: {p.subscription_status}</p>
              </div>)}
              {workspace.partners.length === 0 && <p className="text-sm text-ink/60">no partner accounts in this window.</p>}</div>
          </section>
          <section className="mt-7 rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-semibold">request routing and notifications</h2>
            <Link to="/inbox" className="mt-2 inline-block text-sm font-semibold underline">open non-partner request inbox →</Link>
            <div className="mt-4 grid gap-2">{workspace.requests.map((r) =>
              <p key={r.id} className="rounded-xl bg-cream p-3 text-xs">
                {r.created_at ? new Date(r.created_at).toLocaleString() : ""} · {r.routing_target} · {r.status} · clinic {r.storefront_id}
              </p>)}
              {workspace.requests.length === 0 && <p className="text-sm text-ink/60">no requests in this window.</p>}</div>
            <h3 className="mt-5 text-sm font-semibold">notification delivery</h3>
            <div className="mt-2 grid gap-2">{workspace.notices.map((n) =>
              <p key={n.request_id + n.recipient_type} className="rounded-xl bg-cream p-3 text-xs">
                {n.recipient_type} · {n.delivery_status} · request {n.request_id}
              </p>)}
              {workspace.notices.length === 0 && <p className="text-sm text-ink/60">no notifications in this window.</p>}</div>
          </section>
        </>}
      </>}
    <p className="mt-8 text-xs text-ink/45">this dashboard is read-only. verification, payments and bookings require audited staff workflows. patient scan photos and reports are never loaded here.</p>
  </main>;
}
function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border bg-white p-5">
    <p className="text-3xl font-semibold">{value}</p><p className="mt-2 text-xs text-ink/60">{label}</p>
  </div>;
}
