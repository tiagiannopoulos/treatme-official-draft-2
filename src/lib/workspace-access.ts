/** Server-only authorization. Never trust client roles, emails or user metadata. */
export function isTreatMeStaff(userId: string, allowedIds: string): boolean {
  return allowedIds.split(",").map((id) => id.trim()).filter(Boolean).includes(userId);
}

