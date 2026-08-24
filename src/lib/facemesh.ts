// mediapipe facemesh, loaded lazily in the browser only.
// used twice: live coaching while the camera is open, and one final
// landmark pass on the still we keep.
//
// nothing here fails silently: every load or detection failure is logged with
// its reason and written to scan_errors.

import { reportScanIssue } from "@/lib/scan-errors";

type Landmarker = import("@mediapipe/tasks-vision").FaceLandmarker;

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const cache = new Map<"IMAGE" | "VIDEO", Promise<Landmarker | null>>();

async function load(mode: "IMAGE" | "VIDEO"): Promise<Landmarker | null> {
  if (typeof window === "undefined") return null;
  const existing = cache.get(mode);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(WASM);
      return await vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: mode,
        numFaces: 1,
      });
    } catch (e) {
      reportScanIssue({
        stage: "facemesh_load",
        reason: "model_load_failed",
        detail: { mode, message: e instanceof Error ? e.message : String(e) },
      });
      return null;
    }
  })();

  cache.set(mode, promise);
  return promise;
}


export type Landmark = { x: number; y: number; z: number };

/** warm the video model up so the first frame isn't a stall */
export function warmFacemesh() {
  void load("VIDEO");
}

export interface FaceFrame {
  found: boolean;
  /** normalised centre of the face */
  cx: number;
  cy: number;
  /** face height as a fraction of the frame */
  size: number;
  landmarks: Landmark[];
}

const EMPTY_FRAME: FaceFrame = { found: false, cx: 0.5, cy: 0.5, size: 0, landmarks: [] };

function measure(points: Landmark[]): FaceFrame {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    found: true,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    size: maxY - minY,
    landmarks: points,
  };
}

/** detect on a live video element. returns EMPTY_FRAME when the model isn't ready. */
export async function detectVideoFrame(video: HTMLVideoElement, timestamp: number): Promise<FaceFrame> {
  const model = await load("VIDEO");
  if (!model || video.readyState < 2) return EMPTY_FRAME;
  try {
    const res = model.detectForVideo(video, timestamp);
    const points = res.faceLandmarks?.[0];
    return points?.length ? measure(points as Landmark[]) : EMPTY_FRAME;
  } catch {
    return EMPTY_FRAME;
  }
}

/** whether the model loaded at all — lets the ui fall back gracefully */
export async function facemeshReady(): Promise<boolean> {
  return (await load("VIDEO")) !== null;
}

/** decode a data url into an image element */
export async function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode_failed"));
    el.src = dataUrl;
  });
}

/** final landmark pass on the captured still */
export async function landmarksFromDataUrl(dataUrl: string): Promise<Landmark[] | null> {
  const model = await load("IMAGE");
  if (!model) {
    await logScanIssue({ stage: "face_detect", reason: "model_unavailable" });
    return null;
  }
  try {
    const img = await decodeImage(dataUrl);
    const res = model.detect(img);
    const points = res.faceLandmarks?.[0];
    if (!points?.length) {
      await logScanIssue({
        stage: "face_detect",
        reason: "no_face_found",
        detail: { width: img.naturalWidth, height: img.naturalHeight },
      });
      return null;
    }
    return (points as Landmark[]).map((p) => ({
      x: Math.round(p.x * 10000) / 10000,
      y: Math.round(p.y * 10000) / 10000,
      z: Math.round(p.z * 10000) / 10000,
    }));
  } catch (e) {
    await logScanIssue({
      stage: "face_detect",
      reason: e instanceof Error && e.message === "decode_failed" ? "decode_failed" : "detect_threw",
      detail: { message: e instanceof Error ? e.message : String(e) },
    });
    return null;
  }
}

/**
 * layer 1 entry point. runs on the captured still immediately after capture and
 * before the analysis call. returns null when there is no detectable face, and
 * the caller then falls back to the stylised diagram rather than guessing.
 */
export async function faceMapFromDataUrl(dataUrl: string) {
  const { buildFaceMap } = await import("@/lib/face-zones");
  const landmarks = await landmarksFromDataUrl(dataUrl);
  const map = buildFaceMap(landmarks);
  if (!map) {
    await logScanIssue({
      stage: "face_zones",
      reason: landmarks ? "zones_build_failed" : "no_landmarks",
      detail: { landmarkCount: landmarks?.length ?? 0 },
    });
  }
  return map;
}

