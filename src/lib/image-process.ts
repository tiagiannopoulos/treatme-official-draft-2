// every photo the scan sends is normalised here first: decoded by the browser
// (which turns iphone heic into pixels), redrawn at most 1568px on the long
// edge, and re-encoded as jpeg small enough for the vision api.

export const MAX_EDGE = 1568;
export const MAX_BYTES = 3_500_000;
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

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

/** a live camera frame turned into a compliant jpeg data url, true orientation */
export async function videoToScanJpeg(video: HTMLVideoElement): Promise<string | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const canvas = canvasFor(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // the preview is mirrored in css only, so the source frame is already the
  // true orientation. draw it straight through.
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToScanJpeg(canvas);
}
