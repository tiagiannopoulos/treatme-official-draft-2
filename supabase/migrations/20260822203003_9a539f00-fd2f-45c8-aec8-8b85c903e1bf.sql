drop policy if exists "patients insert own requests" on public.booking_requests;
drop policy if exists "patients read own requests" on public.booking_requests;

alter table public.booking_requests
  drop column if exists patient_id,
  drop column if exists treatment_id,
  drop column if exists preferred_slots,
  drop column if exists patient_name,
  drop column if exists patient_phone,
  drop column if exists patient_email,
  drop column if exists note;

alter table public.booking_requests alter column status set default 'new';

grant select, insert on public.booking_requests to authenticated;
grant insert on public.booking_requests to anon;
grant all on public.booking_requests to service_role;

create index if not exists booking_requests_user_created_idx
  on public.booking_requests (user_id, created_at desc);