import { createFileRoute, Link } from "@tanstack/react-router";

import { useScan } from "@/lib/scan-store";
import { PillButton } from "@/components/treatme/PillButton";
import { SavedTreatments } from "@/components/treatme/profile/SavedTreatments";
import { TreatmentJourney } from "@/components/treatme/profile/TreatmentJourney";
import { UpcomingAppointments } from "@/components/treatme/profile/UpcomingAppointments";
import { TxLog } from "@/components/treatme/profile/TxLog";
import { AboutYourSkin } from "@/components/treatme/profile/AboutYourSkin";
import { AccountCard } from "@/components/treatme/profile/AccountCard";
import { MyScans } from "@/components/treatme/profile/MyScans";
import { DangerZone } from "@/components/treatme/profile/DangerZone";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "profile · treatme" },
      { name: "description", content: "your account, your scans, your bookings." },
      { property: "og:title", content: "profile · treatme" },
      { property: "og:description", content: "your account, your scans, your bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function SignedOut() {
  const { openAuth } = useAuth();
  return (
    <div className="px-6 pt-6">
      <h1 className="brand-display text-[32px] mt-2 lowercase">
        profile<span className="text-hot">.</span>
      </h1>
      <div className="mt-6 rounded-[18px] p-6" style={{ backgroundColor: "#FFEDB4" }}>
        <p className="text-[16px] font-semibold lowercase">save your results.</p>
        <p className="mt-2 text-[13px] lowercase leading-relaxed text-ink/65">
          you'll need an account to scan and to book. takes a second.
        </p>
        <div className="mt-4">
          <PillButton fullWidth onClick={() => openAuth()}>
            log in or sign up
          </PillButton>
        </div>
      </div>
      <p className="mt-4 text-[12.5px] lowercase leading-relaxed text-ink/55">
        everything else stays open. keep browsing treatments, clinics and providers without an account.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Link to="/treatments">
          <PillButton fullWidth variant="outline">
            browse treatments
          </PillButton>
        </Link>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user, ready } = useAuth();
  const { analysis, photoDataUrl } = useScan();

  if (!ready) return <div className="px-6 pt-10 text-[13px] lowercase text-ink/45">one sec.</div>;
  if (!user) return <SignedOut />;

  return (
    <div className="px-6 pt-6">
      <h1 className="brand-display text-[32px] mt-2 lowercase">
        profile<span className="text-hot">.</span>
      </h1>

      <AccountCard />

      {analysis && photoDataUrl && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
          <img src={photoDataUrl} alt="last scan" className="size-16 rounded-xl object-cover" />
          <div className="flex-1">
            <p className="font-bold lowercase">latest scan</p>
            <p className="text-[12px] lowercase text-ink-mute">
              skin age {analysis.skinAge} · fitzpatrick {analysis.fitzpatrick}
            </p>
          </div>
          <Link to="/scan/results">
            <PillButton variant="outline" className="h-10 px-4 text-[13px]">
              view
            </PillButton>
          </Link>
        </div>
      )}

      <div className="mt-5">
        <Link to="/scan">
          <PillButton fullWidth>new scan</PillButton>
        </Link>
      </div>

      <UpcomingAppointments />
      <MyScans />
      <TreatmentJourney />
      <SavedTreatments />
      <TxLog />
      <AboutYourSkin />
      <DangerZone />

      <div className="mt-8 mb-4">
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <PillButton fullWidth variant="outline" onClick={() => signOut()}>
      log out
    </PillButton>
  );
}
