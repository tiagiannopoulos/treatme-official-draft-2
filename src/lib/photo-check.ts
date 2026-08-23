/**
 * the cheap gate that runs before the expensive read. one small vision call
 * decides whether a photo can be read at all, and every reason maps to a
 * fixable instruction the patient can act on.
 */

export const PHOTO_REASONS = [
  "no_face",
  "multiple_faces",
  "too_dark",
  "too_bright",
  "blurry",
  "too_far",
  "too_close",
  "face_angled",
  "partially_covered",
  "heavy_makeup",
  "filter_detected",
  "obstruction",
] as const;

export type PhotoReason = (typeof PHOTO_REASONS)[number];

export interface PhotoCheck {
  usable: boolean;
  reasons: PhotoReason[];
  detail: string;
}

export const PHOTO_REASON_COPY: Record<PhotoReason, string> = {
  no_face: "we could not find a face in that one. face the camera straight on and fill the oval.",
  multiple_faces: "there is more than one face in this photo. we need just you.",
  too_dark: "it is too dark to read your skin. face a window or turn on a light in front of you, not behind you.",
  too_bright: "the light is blowing out the detail. move out of direct sun or step away from the lamp.",
  blurry: "that one came out blurry. hold the phone steady and try again.",
  too_far: "you are a bit far away. bring the phone closer so your face fills the oval.",
  too_close: "you are a little too close. hold the phone about arm's length away.",
  face_angled: "your face is turned away. look straight at the camera.",
  partially_covered: "part of your face is out of frame. fit your whole face inside the oval.",
  heavy_makeup: "makeup is covering what we need to read. this works best on clean skin.",
  filter_detected: "there is a filter on this photo. we need the real thing.",
  obstruction: "something is covering part of your face. hair, glasses or a hand.",
};

/** two things to fix is actionable. five is defeating. */
export function photoReasonMessages(reasons: PhotoReason[]): string[] {
  const seen = new Set<PhotoReason>();
  const out: string[] = [];
  for (const r of reasons) {
    if (seen.has(r) || !PHOTO_REASON_COPY[r]) continue;
    seen.add(r);
    out.push(PHOTO_REASON_COPY[r]);
    if (out.length === 2) break;
  }
  return out.length ? out : [PHOTO_REASON_COPY.no_face];
}

export const LOW_QUALITY_NOTE = "photo quality was low, this reading may be less accurate";

export function isPhotoReason(value: unknown): value is PhotoReason {
  return typeof value === "string" && (PHOTO_REASONS as readonly string[]).includes(value);
}
