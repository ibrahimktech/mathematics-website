/**
 * Sticky "+994" prefix behavior for phone inputs, shared by sign-up and the
 * account settings form. Pure and client-safe; validation itself lives in
 * lib/security/password.ts (`normalizePhone` / `validatePhone`).
 */

/** Every account number starts here; the field is editable only after it. */
export const PHONE_PREFIX = "+994";

/**
 * Re-pins "+994" to whatever the field now contains, so the country code cannot
 * be edited away. The three cases are distinguished deliberately: digits that
 * merely SURVIVED a delete inside the code ("+99") must not be re-read as the
 * start of a subscriber number, or backspacing would silently build a different
 * number instead of restoring the code.
 */
export function pinCountryCode(input: string): string {
  // Normal editing: keep the digits after the code, drop everything else.
  if (input.startsWith(PHONE_PREFIX))
    return PHONE_PREFIX + input.slice(PHONE_PREFIX.length).replace(/\D/g, "");

  const digits = input.replace(/\D/g, "");
  // Pasted complete, with or without the "+".
  if (digits.startsWith("994")) return PHONE_PREFIX + digits.slice(3);
  // "", "9", "99", "994" — the code itself was edited. Put it back, nothing more.
  if ("994".startsWith(digits)) return PHONE_PREFIX;
  // Pasted without the country code; kept so a wrong number shows an error
  // rather than vanishing.
  return PHONE_PREFIX + digits;
}
