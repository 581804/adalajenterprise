import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";

/**
 * Validates a phone number is genuinely well-formed for its country — not
 * just "digits of roughly the right length". libphonenumber-js checks real
 * numbering-plan rules (length, valid prefixes) per country, the same
 * validation logic used by Android/Google's own phone number handling.
 *
 * @param phone - Local number as entered, WITHOUT the country calling code
 *                (e.g. "9876543210", not "+919876543210")
 * @param iso2 - ISO 3166-1 alpha-2 country code (e.g. "IN")
 */
export function isValidPhoneForCountry(phone: string, iso2: string): boolean {
  if (!phone || !iso2) return false;
  try {
    return isValidPhoneNumber(phone, iso2 as any);
  } catch {
    return false;
  }
}

/**
 * Combines a local number + country into the canonical E.164 format
 * (+<calling code><number>, no spaces/dashes) for storage. Returns null if
 * the number isn't valid for that country — callers should validate first.
 */
export function toE164(phone: string, iso2: string): string | null {
  try {
    const parsed = parsePhoneNumber(phone, iso2 as any);
    return parsed.isValid() ? parsed.number : null; // .number is already E.164
  } catch {
    return null;
  }
}
