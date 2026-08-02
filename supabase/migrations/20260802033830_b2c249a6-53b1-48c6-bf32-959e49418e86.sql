alter table public.treatments
  add column if not exists icon_url text,
  add column if not exists poster_url text,
  add column if not exists accent_color text default '#F8A1C6',
  add column if not exists blurb text,
  add column if not exists avg_price_low int,
  add column if not exists avg_price_high int,
  add column if not exists downtime_label text;

update public.treatments set accent_color = '#F8A1C6' where accent_color is null;

alter table public.treatment_story_slides enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'treatment_story_slides_slug_index_key'
  ) then
    alter table public.treatment_story_slides
      add constraint treatment_story_slides_slug_index_key unique (treatment_slug, slide_index);
  end if;
end $$;

grant select on public.treatment_story_slides to anon, authenticated;
grant all on public.treatment_story_slides to service_role;

drop policy if exists "slides public read" on public.treatment_story_slides;
create policy "treatment_story_slides_public_read"
  on public.treatment_story_slides
  for select
  to anon, authenticated
  using (true);
