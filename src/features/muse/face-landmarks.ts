/**
 * mediapipe face-landmarker helpers.
 *
 * the model .task file is loaded from google's cdn at runtime; every entry
 * point here degrades gracefully (returns null / false) when offline, when
 * webgl is unavailable, or when no face is found.
 */

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

export interface Landmark {
  x: number;
  y: number;
}

let landmarkerPromise: Promise<FaceLandmarker | null> | null = null;

function getLandmarker(): Promise<FaceLandmarker | null> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "IMAGE",
          numFaces: 1,
        });
      } catch {
        // offline, no webgl, cdn blocked — caller falls back.
        return null;
      }
    })();
  }
  return landmarkerPromise;
}

/** the white wireframe tesselation used for the live capture overlay. */
export function tesselation(): { start: number; end: number }[] {
  return FaceLandmarker.FACE_LANDMARKS_TESSELATION;
}

export function loadImage(
  dataUrl: string,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * detect 478 normalized landmarks (0..1, relative to the source image) on an
 * image-like source. returns null when the model can't load or no face found.
 */
export async function detectLandmarks(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): Promise<Landmark[] | null> {
  const fl = await getLandmarker();
  if (!fl) return null;
  try {
    const res = fl.detect(source);
    const face = res.faceLandmarks?.[0];
    if (!face) return null;
    return face.map((p) => ({ x: p.x, y: p.y }));
  } catch {
    return null;
  }
}

export async function detectLandmarksFromDataUrl(
  dataUrl: string,
): Promise<Landmark[] | null> {
  const img = await loadImage(dataUrl);
  if (!img) return null;
  return detectLandmarks(img);
}

/**
 * mean luminance (0..255) of the center region of a video frame.
 * used for the "find better light" alignment hint.
 */export function frameBrightness(video: HTMLVideoElement): number | null {
  try {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = 36;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    // center half of the frame, downscaled for speed.
    ctx.drawImage(
      video,
      w * 0.25,
      h * 0.25,
      w * 0.5,
      h * 0.5,
      0,
      0,
      48,
      36,
    );
    const data = ctx.getImageData(0, 0, 48, 36).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    return sum / (data.length / 4);
  } catch {
    return null;
  }
}

export interface Alignment {
  ok: boolean;
  hint: string; // lowercase guidance, or "ok"
}

/** lovi-style alignment: centered + large enough + bright enough. */
export function checkAlignment(
  landmarks: Landmark[] | null,
  brightness: number | null,
): Alignment {
  if (!landmarks || landmarks.length < 100) {
    return { ok: false, hint: "find your face" };
  }
  let minX = 1,
    maxX = 0,
    minY = 1,
    maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = maxX - minX;
  if (brightness !== null && brightness < 55) {
    return { ok: false, hint: "find better light" };
  }
  if (w < 0.34) {
    return { ok: false, hint: "move closer" };
  }
  if (Math.abs(cx - 0.5) > 0.1 || Math.abs(cy - 0.5) > 0.12) {
    return { ok: false, hint: "center your face" };
  }
  return { ok: true, hint: "ok" };
}

export interface CoverMap {
  /** displayed css px covered per normalized unit */
  scaleX: number;
  scaleY: number;
  /** crop offset of the displayed region's top-left, in css px (negative when cropped) */
  offsetX: number;
  offsetY: number;
  /** displayed element size, css px */
  ew: number;
  eh: number;
  /** intrinsic video frame size */
  vw: number;
  vh: number;
  /** the cover scale factor */
  s: number;
}

/**
 * object-fit: cover mapping.
 *
 * the video element crops its frame to fill the element box. landmarks are
 * normalized to the FULL frame (videoWidth x videoHeight), so drawing them
 * straight onto the element box detaches the mesh whenever the frame aspect
 * differs from the element aspect (typical on iphone front cameras).
 * this returns the transform from normalized frame coords to displayed css px.
 */
export function coverMap(
  vw: number,
  vh: number,
  ew: number,
  eh: number,
): CoverMap | null {
  if (!vw || !vh || !ew || !eh) return null;
  const s = Math.max(ew / vw, eh / vh);
  return {
    scaleX: vw * s,
    scaleY: vh * s,
    offsetX: (ew - vw * s) / 2,
    offsetY: (eh - vh * s) / 2,
    ew,
    eh,
    vw,
    vh,
    s,
  };
}

/** map one normalized landmark through the cover transform (+ optional mirror). */
export function mapCoverPoint(
  m: CoverMap,
  x: number,
  y: number,
  mirror: boolean,
): { x: number; y: number } {
  const lx = mirror ? 1 - x : x;
  return { x: m.offsetX + lx * m.scaleX, y: m.offsetY + y * m.scaleY };
}
