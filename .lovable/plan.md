# treatment image uploads

Let you upload your own pictures for each treatment, used on the treatment cards in the "picked for you" section and the treatments tab.

## what happens

1. **new storage bucket `treatment-images` (public)**
   - created via the storage tool, with a 5MB per-file cap
   - policies via migration: anyone can view images; only signed-in users can upload/overwrite/delete

2. **new admin screen at `/dev/treatment-images`**
   - lists every treatment with its current picture
   - tap a treatment → pick a photo from your phone → it uploads to the bucket and saves the public URL to that treatment's `poster_url`
   - images are resized client-side before upload so uploads are fast
   - shows a small preview after saving so you can confirm the vibe
   - this screen is for you (the owner); it's a plain route, not linked in the nav. i'll keep it simple — signed-in users only. if you want it locked to just your account, say so and i'll gate it to your user id.

3. **nothing else changes** — the cards already read `poster_url`, so once a URL is saved, the new picture shows up everywhere (picked for you, treatments tab, search) after a refresh.

## technical notes

- bucket: `treatment-images` via `supabase--storage_create_bucket` (public, 5MB limit)
- migration: `storage.objects` policies for the new bucket (public read, authenticated write)
- new route: `src/routes/dev.treatment-images.tsx` — grid of treatments, file input, `supabase.storage.from("treatment-images").upload()`, then `treatments.update({ poster_url })`
- publish after uploading so the pictures appear on treatmeapp.com
