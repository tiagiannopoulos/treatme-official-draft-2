import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * where the patient actually is. one value, asked for in context and never on
 * app open. signed out people keep it on the device, signed in people keep it
 * on patient_profile, and the device value migrates up on sign in.
 */

export type LocationSource = "gps" | "manual";

export interface PatientLocation {
  lat: number;
  lng: number;
  label: string;
  source: LocationSource;
  setAt: number;
}

const KEY = "treatme.location.v1";

let value: PatientLocation | null = null;
let hydrated = false;
/** true once we have looked in both places, so the ui knows when to ask. */
let ready = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readDevice(): PatientLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PatientLocation>;
    if (typeof p.lat !== "number" || typeof p.lng !== "number") return null;
    return {
      lat: p.lat,
      lng: p.lng,
      label: p.label ?? "your location",
      source: p.source === "gps" ? "gps" : "manual",
      setAt: typeof p.setAt === "number" ? p.setAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeDevice(next: PatientLocation | null) {
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked, in memory value still works for this session */
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function pushToProfile(loc: PatientLocation) {
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase.from("patient_profile").upsert(
    {
      user_id: uid,
      lat: loc.lat,
      lng: loc.lng,
      location_label: loc.label,
      location_source: loc.source,
      location_set_at: new Date(loc.setAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("patient_profile location upsert failed", error);
}

/** the profile wins when it has a value, otherwise the device value migrates up. */
async function hydrateFromProfile() {
  const uid = await currentUserId();
  if (!uid) {
    ready = true;
    emit();
    return;
  }
  const { data, error } = await supabase
    .from("patient_profile")
    .select("lat, lng, location_label, location_source, location_set_at")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) console.error("patient_profile location read failed", error);

  if (data && data.lat !== null && data.lng !== null) {
    value = {
      lat: Number(data.lat),
      lng: Number(data.lng),
      label: data.location_label ?? "your location",
      source: data.location_source === "gps" ? "gps" : "manual",
      setAt: data.location_set_at ? Date.parse(data.location_set_at) : Date.now(),
    };
    writeDevice(value);
  } else if (value) {
    await pushToProfile(value);
  }
  ready = true;
  emit();
}

function subscribe(listener: () => void) {
  if (!hydrated) {
    hydrated = true;
    value = readDevice();
    void hydrateFromProfile();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): PatientLocation | null {
  return value;
}

function readySnapshot(): boolean {
  return ready;
}

export function setPatientLocation(next: PatientLocation) {
  value = next;
  writeDevice(next);
  emit();
  void pushToProfile(next);
}

export function clearPatientLocation() {
  value = null;
  writeDevice(null);
  emit();
}

/** browser prompt. resolves null when refused or unavailable. */
export function requestGpsLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  });
}

export function usePatientLocation() {
  const location = useSyncExternalStore(subscribe, snapshot, () => null);
  const isReady = useSyncExternalStore(subscribe, readySnapshot, () => false);

  const save = useCallback((next: Omit<PatientLocation, "setAt">) => {
    setPatientLocation({ ...next, setAt: Date.now() });
  }, []);

  /** a fresh sign in should pull the profile value straight away. */
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void hydrateFromProfile();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { location, ready: isReady, save, clear: clearPatientLocation };
}
