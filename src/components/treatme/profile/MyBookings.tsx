import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { myBookingsQuery, slotDateLabel, statusChip } from "@/lib/booking";

/** the patient's own requests only. rls does the scoping. */
export function MyBookings() {
  const { data: bookings = [], isLoading } = useQuery(myBookingsQuery);

  return (
    <section className="mt-10">
      <p className="brand-eyebrow">your requests</p>
      <h2 className="brand-display text-[24px] mt-1 lowercase">my bookings<span className="text-hot">.</span></h2>

      {isLoading && <p className="mt-3 text-[13px] lowercase text-ink/45">loading your requests.</p>}

      {!isLoading && bookings.length === 0 && (
        <div className="mt-3 rounded-[16px] border border-dashed border-line p-5">
          <p className="text-[14px] lowercase text-ink/60">no booking requests yet.</p>
          <Link
            to="/search"
            search={{ q: undefined, scope: undefined }}
            className="mt-2 inline-block text-[13px] font-semibold lowercase text-hot"
          >
            find a provider
          </Link>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {bookings.map((b) => {
          const chip = statusChip(b.status);
          return (
            <div key={b.id} className="rounded-[16px] border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[16px] lowercase">{b.treatmentName.toLowerCase()}</p>
                  <Link
                    to="/provider/$id"
                    params={{ id: b.providerId }}
                    className="mt-0.5 block text-[13px] lowercase text-ink/60"
                  >
                    with {b.providerName.toLowerCase()}
                  </Link>
                  <Link
                    to="/storefront/$id"
                    params={{ id: b.storefrontId }}
                    className="block text-[13px] lowercase text-ink/60"
                  >
                    {b.storefrontName.toLowerCase()}
                    {b.neighbourhood ? ` · ${b.neighbourhood.toLowerCase()}` : ""}
                  </Link>
                </div>
                <span
                  className="rounded-pill px-3 py-1 text-[11px] font-semibold lowercase"
                  style={{ backgroundColor: chip.bg, color: chip.fg }}
                >
                  {chip.label}
                </span>
              </div>

              {b.slots.length > 0 && (
                <p className="mt-3 text-[12px] lowercase text-ink/50">
                  you asked for {b.slots.map((s) => `${slotDateLabel(s.date)} ${s.time_of_day}`).join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
