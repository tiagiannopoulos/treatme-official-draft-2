import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScanFace, ShieldCheck, ArrowRight } from "lucide-react";
import { getPublicBrandedClinic } from "@/lib/consultations/request.functions";

export const Route = createFileRoute("/c/$slug")({
  component: BrandedClinicPage,
  head: () => ({ meta: [{ title: "your skin consultation · treatme" }] }),
});
function BrandedClinicPage() {
  const { slug } = Route.useParams();
  const { data: clinic, isPending, isError } = useQuery({
    queryKey: ["partner-landing", slug],
    queryFn: () => getPublicBrandedClinic({ data: { slug } }),
    retry: 1,
  });
  if (isPending) {
    return <main className="mx-auto max-w-lg px-6 py-24 text-center text-ink/60">checking clinic availability…</main>;
  }
  if (!clinic || isError) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="brand-display text-3xl">this clinic link isn't active yet.</h1>
        <p className="mt-4 text-sm text-ink/60">Only verified, active TreatMe partner clinics have branded links.</p>
        <Link to="/search" search={{ q: undefined, scope: undefined, treatment: undefined }}
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">discover clinics instead</Link>
      </main>
    );
  }
  const accent = /^#[0-9a-f]{6}$/i.test(clinic.brand_accent || "") ? clinic.brand_accent! : "#F8A1C6";
  return (
    <main className="mx-auto max-w-lg px-5 pt-10 pb-28 lowercase">
      <div className="rounded-3xl px-6 py-8 text-center" style={{ background: accent }}>
        {clinic.logo_url && <img src={clinic.logo_url} alt={clinic.name} className="mx-auto mb-4 size-20 rounded-2xl bg-white object-cover" />}
        <span className="inline-flex items-center gap-1 text-xs font-semibold"><ShieldCheck className="size-4"/> treatme partner</span>
        <h1 className="mt-4 brand-display text-3xl">{clinic.name}</h1>
        <p className="mt-2 text-sm">{clinic.city}</p>
      </div>
      <div className="mt-8">
        <h2 className="brand-display text-[28px]">understand your skin before your consultation.</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/65">
          Take three guided photos for a cosmetic skin report. Then request a consultation directly with {clinic.name}.
          Your photo and report are not shared with the clinic without separate permission.
        </p>
      </div>
      <Link to="/muse/scan" search={{ clinic: slug }}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 text-sm font-semibold text-white">
        <ScanFace className="size-5"/> start my skin scan <ArrowRight className="size-4"/>
      </Link>
      <Link to="/storefront/$id/request" params={{ id: clinic.id }} search={{ treatment: undefined }}
        className="mt-4 block text-center text-sm font-semibold underline underline-offset-4">
        request a consultation without a scan
      </Link>
      <p className="mt-8 text-xs leading-relaxed text-ink/45">
        cosmetic and educational only. this is not a medical assessment or a confirmed appointment.
        no payment is taken when submitting a request.
      </p>
    </main>
  );
}
