grant select, insert, update, delete on public.saved_treatments to authenticated;
grant all on public.saved_treatments to service_role;

grant select, insert, update, delete on public.patient_profile to authenticated;
grant all on public.patient_profile to service_role;

grant select, insert, update, delete on public.patient_health_flags to authenticated;
grant all on public.patient_health_flags to service_role;