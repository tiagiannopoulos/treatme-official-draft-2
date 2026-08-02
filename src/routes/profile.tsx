import { createFileRoute } from "@tanstack/react-router";
import { useScan } from "@/lib/scan-store";
import { PillButton } from "@/components/treatme/PillButton";
import { Link } from "@tanstack/react-router";
import { SavedTreatments } from "@/components/treatme/profile/SavedTreatments";
import { TreatmentJourney } from "@/components/treatme/profile/TreatmentJourney";
import { UpcomingAppointments } from "@/components/treatme/profile/UpcomingAppointments";
import { TxLog } from "@/components/treatme/profile/TxLog";
import { AboutYourSkin } from "@/components/treatme/profile/AboutYourSkin";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "profile · treatme" }, { name: "description", content: "your treatment journey." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { analysis, photoDataUrl, reset } = useScan();
  return (
    <div className="px-6 pt-6">
      <h1 className="brand-display text-[32px] mt-2">profile<span className="text-hot">.</span></h1>
      {analysis && photoDataUrl ? (
        <div className="mt-5 rounded-2xl bg-card border border-line p-4 flex items-center gap-4">
          <img src={photoDataUrl} alt="last scan" className="size-16 rounded-xl object-cover" />
          <div className="flex-1">
            <p className="font-bold">latest scan</p>
            <p className="text-[12px] text-ink-mute">skin age {analysis.skinAge} · fitzpatrick {analysis.fitzpatrick}</p>
          </div>
          <Link to="/scan/results"><PillButton variant="outline" className="h-10 px-4 text-[13px]">view</PillButton></Link>
        </div>
      ) : (
        <p className="mt-3 text-ink-mute text-[14px]">no scan saved yet.</p>
      )}
      <div className="mt-6 flex flex-col gap-3">
        <Link to="/scan"><PillButton fullWidth>new scan</PillButton></Link>
        <PillButton fullWidth variant="outline" onClick={reset}>clear session</PillButton>
      </div>
      <TreatmentJourney />
      <SavedTreatments />
      <UpcomingAppointments />
      <TxLog />
      <AboutYourSkin />
    </div>
  );
}
