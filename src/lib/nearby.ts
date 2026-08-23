import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { nearbyStorefrontsQuery } from "@/lib/search-data";
import { usePatientLocation } from "@/lib/patient-location";

/**
 * every distance in the app comes from postgres, keyed by storefront id. when we
 * do not know where the patient is, kmFor returns null and the surface shows the
 * area instead of an invented number.
 */
export function useNearbyKm(radiusKm = 500) {
  const { location } = usePatientLocation();
  const point = location ? { lat: location.lat, lng: location.lng } : null;
  const { data } = useQuery(nearbyStorefrontsQuery(point, radiusKm));

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data ?? []) map.set(row.id, row.km);
    return {
      hasLocation: Boolean(location),
      label: location?.label ?? null,
      kmFor: (id: string): number | null => (location ? (map.get(id) ?? null) : null),
    };
  }, [data, location]);
}
