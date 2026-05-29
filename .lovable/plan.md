## what's actually failing

your last upload was a `.heic` file straight from an iPhone (`data:image/heic;base64,...` in the network log). two problems stack up:

1. browsers can't decode HEIC in `<img>` / canvas, so our `downscale()` silently falls back to returning the original HEIC data URL.
2. that HEIC payload gets POSTed to `/api/analyze` → Gemini rejects it → server returns "couldn't get a clear read."

so the error message is technically correct but misleading — the photo never even got looked at.

## fix (small, surgical, frontend-only)

edit `src/routes/scan.index.tsx`:

1. **detect HEIC/HEIF up front** by file type and extension, and reject with a brand-voice toast:
   > "heic photos aren't supported yet. switch your iphone camera to 'most compatible' (settings → camera → formats) or upload a jpg/png."
2. **make `downscale()` strict**: if the image fails to decode, throw instead of returning the original data url. that way we never silently ship an undecodable blob to the API.
3. **trust the re-encode**: after a successful canvas draw we already output `image/jpeg` — keep that, so anything that *does* decode arrives at the API as clean JPEG.
4. minor: tighten the camera input to `accept="image/jpeg,image/png"` so the iOS picker steers users away from HEIC when possible (camera capture itself already returns JPEG).

## out of scope (call out, don't build)

- auto-converting HEIC client-side would need a library like `heic2any` (~500kb wasm). happy to add it as a follow-up if you want iPhone users to never have to think about formats — just say the word.
- no backend changes needed; `/api/analyze` stays as-is.

ready to implement on approval.