/** shared display formatters. */

/**
 * north american phone numbers render as 226-751-3325 everywhere. anything we
 * can't read as 10 digits comes back trimmed and untouched.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw.trim();
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** live formatting while someone types into a phone field. */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length <= 3) return ten;
  if (ten.length <= 6) return `${ten.slice(0, 3)}-${ten.slice(3)}`;
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6, 10)}`;
}
