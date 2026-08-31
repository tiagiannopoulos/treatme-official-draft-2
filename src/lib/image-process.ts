// every photo the scan sends is normalised here first: decoded by the browser
// (which turns iphone heic into pixels), redrawn at most 1568px on the long
// edge, and re-encoded as jpeg small enough for the vision api.

export const MAX_EDGE = 1568;
export const MAX_BYTES = 3_500_000;
/** every small scan image in the app (list rows, 44px maps) uses this copy */
export const THUMB_EDGE = 320;
export const THUMB_QUALITY = 0.7;
/** the one shape the stream, the preview and the capture all agree on.
 *  9:16 matches a phone screen, so the fullscreen preview crops almost
 *  nothing off the sides and the camera stops looking zoomed in. */
export const CAPTURE_ASPECT = 9 / 16;
/** no digital zoom: what you see in the preview is what gets captured */
export const CAPTURE_ZOOM = 1;
const QUALITIES = [0.85, 0.7, 0.55, 0.4];


/** the exact cover crop the preview shows (capture shape, no extra zoom) */
export function coverCrop(srcW: number, srcH: number) {
  const srcAspect = srcW / srcH;
  let w = srcW;
  let h = srcH;
  if (srcAspect > CAPTURE_ASPECT) w = srcH * CAPTURE_ASPECT;
  else h = srcW / CAPTURE_ASPECT;
  w /= CAPTURE_ZOOM;
  h /= CAPTURE_ZOOM;
  return { x: (srcW - w) / 2, y: (srcH - h) / 2, w, h };
}


function canvasFor(width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(blob);
  });
}

/** encode a prepared canvas down until it fits the api byte budget */
export async function canvasToScanJpeg(canvas: HTMLCanvasElement): Promise<string> {
  let last: Blob | null = null;
  for (const quality of QUALITIES) {
    const blob = await toBlob(canvas, quality);
    if (!blob) continue;
    last = blob;
    if (blob.size <= MAX_BYTES) break;
  }
  if (!last) throw new Error("encode_failed");
  return blobToDataUrl(last);
}

/** a picked file (heic included) turned into a compliant jpeg data url */
export async function fileToScanJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = canvasFor(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToScanJpeg(canvas);
}

/**
 * a live camera frame turned into a compliant jpeg data url. we draw only the
 * region the 3:4 preview is actually showing (same cover crop, same zoom), so
 * the saved photo is identical to what was framed on screen.
 */
export async function videoToScanJpeg(video: HTMLVideoElement): Promise<string | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const crop = coverCrop(w, h);
  const canvas = canvasFor(crop.w, crop.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // the preview is mirrored in css only, so the source frame is already the
  // true orientation. draw the cropped region straight through.
  ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  return canvasToScanJpeg(canvas);
}

/**
 * a 320px long edge jpeg used for every small scan image. cheap to fetch, so a
 * list of ten scans is a few kilobytes instead of ten full size photos.
 */
export async function dataUrlToThumbBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const source = await fetch(dataUrl).then((r) => r.blob());
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await toBlob(canvas, THUMB_QUALITY);
  } catch (err) {
    console.warn("[treatme] thumbnail encode failed", err);
    return null;
  }
}
