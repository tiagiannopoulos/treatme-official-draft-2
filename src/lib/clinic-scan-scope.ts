/** Apply provider-specific commercial limits without altering the skin analysis itself. */
export interface ClinicTreatmentOffer {
  slug: string;
  verified: boolean;
}

/** Only explicitly clinic-confirmed listed services can appear on a branded scan. */
export function verifiedClinicTreatmentSlugs(
  offers: readonly ClinicTreatmentOffer[] | null | undefined,
): string[] {
  return Array.from(new Set(
    (offers ?? [])
      .filter((offer) => offer.verified === true && typeof offer.slug === "string" && offer.slug.trim().length > 0)
      .map((offer) => offer.slug),
  )).sort();
}
