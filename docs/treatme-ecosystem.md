# TreatMe ecosystem implementation — draft PR #2

## Journeys
- Organic TreatMe: consumer scans with Muse, reviews educational report, explicitly chooses a clinic in discovery, and submits a request (not a confirmed appointment).
- Branded /c/:slug: only verified active clinic memberships expose the link. The clinic slug survives the Muse scan; the report routes to the same clinic. Consumers may independently choose discovery.
- Clinic operations: verified active partners can view only routed requests for their clinics via /inbox. /admin displays their own membership/activation status, but not patient data until active.
- TreatMe operations: /admin provides a server-authorized read-only claim review queue, partner status, request routing and notice delivery. Staff-only access is determined by verified auth user ID in TREATME_ADMIN_USER_IDS. Counts are capped at 100 and explicitly labeled.
- Claim forms are leads only. They do not verify identity or activate membership. No staff write actions are available in this preview.

## Privacy and security boundaries
- Do not send photos, scan results or clinical details to clinics by default. Contact consent is separate; report sharing needs an independent explicit flow.
- Never trust a client-side role flag. Privileged data reads use server-verified Supabase auth identity and service-role queries after checking authorization.
- Production deployment, migrations, payments, notifications, and real provider activation are not authorized in this draft. Test using synthetic records in an isolated staging database.
- Video room access is gated on a confirmed booking, paid session, authorized patient/clinic and time window. It is NOT a working paid booking product yet.

## Still required before launch
1. Fix failing Vercel preview using actual deployment logs; configure staging-only environment and apply/review SQL migrations there. Do not use production Supabase.
2. Independent clinic identity/license verification with auditable staff actions, scoped role grants and status-change history.
3. Stripe $20 checkout, secure webhook verification, clinic payout/credit rules, refund handling and reconciliation. No fee is charged in current flows.
4. Calendar/availability confirmation, scheduling transitions, email reliability and secure in-app notifications.
5. Explicit report-sharing consent, access revocation, privacy/retention policies, regulatory and threat-model review; mobile Safari camera/microphone tests.
6. End-to-end staging tests for admin vs clinic data isolation, request routing, RLS and anti-spam controls.
