/**
 * Password and email rules, shared by the client forms AND the server actions
 * so the two can never drift. Client-side checks exist only for fast feedback;
 * the server action re-runs exactly these functions, and Supabase Auth enforces
 * its own configured minimum on top (see README "Password policy").
 *
 * NOTE ON HASHING: this app never sees a password at rest. Supabase Auth (GoTrue)
 * stores only a bcrypt hash of the password; nothing here writes, caches or logs
 * the plaintext. That is why there is no hashing code in this repo — adding our
 * own would mean building a second, weaker credential store.
 */

/** bcrypt (used by Supabase Auth) silently truncates past 72 BYTES. */
export const MAX_PASSWORD_BYTES = 72;
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Passwords that show up at the top of every breach list. Not a substitute for
 * a real breach-corpus check (see `validatePassword` notes) — just a cheap
 * filter for the worst offenders.
 */
const WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789",
  "1234567890", "qwertyuiop", "qwerty123", "iloveyou", "admin123", "welcome1",
  "letmein123", "abc123456", "riyaziyyat", "matematika", "parol123", "azerbaijan",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

/** Trim + lowercase. Always store/compare the normalized form. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Azerbaijani error message, or null when the email is acceptable. */
export function validateEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) return "E-poçt tələb olunur.";
  if (email.length > 254) return "E-poçt çox uzundur.";
  if (!EMAIL_RE.test(email)) return "E-poçt ünvanı düzgün deyil.";
  return null;
}

/**
 * Azerbaijani error message, or null when the password is acceptable.
 *
 * Rules: 10–72 characters, at least one lower-case letter, one upper-case
 * letter and one digit, not a well-known weak password, and not simply the
 * user's own email/name. Whitespace-only padding is rejected but internal
 * spaces are allowed — passphrases are good passwords.
 */
export function validatePassword(
  password: string,
  context: { email?: string; name?: string } = {},
): string | null {
  if (!password) return "Şifrə tələb olunur.";
  if (password.trim().length === 0) return "Şifrə yalnız boşluqdan ibarət ola bilməz.";
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Şifrə ən azı ${MIN_PASSWORD_LENGTH} simvol olmalıdır.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES)
    return "Şifrə çox uzundur (maksimum 72 bayt).";
  // Unicode-aware so Azerbaijani letters (ə, ö, ü, ç, ş, ğ, ı, İ) count.
  if (!/\p{Ll}/u.test(password)) return "Şifrədə ən azı bir kiçik hərf olmalıdır.";
  if (!/\p{Lu}/u.test(password)) return "Şifrədə ən azı bir böyük hərf olmalıdır.";
  if (!/\p{Nd}/u.test(password)) return "Şifrədə ən azı bir rəqəm olmalıdır.";

  const lower = password.toLowerCase();
  if (WEAK_PASSWORDS.has(lower)) return "Bu şifrə çox geniş yayılıb. Başqa şifrə seçin.";
  if (/^(.)\1+$/.test(password)) return "Şifrə çox sadədir.";

  const local = context.email ? normalizeEmail(context.email).split("@")[0] : "";
  if (local && local.length >= 3 && lower.includes(local))
    return "Şifrə e-poçt ünvanınızı ehtiva edə bilməz.";
  const name = context.name?.trim().toLowerCase();
  if (name && name.length >= 3 && lower.includes(name))
    return "Şifrə adınızı ehtiva edə bilməz.";

  return null;
}

/** The only accepted shape: +994 followed by exactly 9 digits. */
const PHONE_RE = /^\+994\d{9}$/;

/**
 * Trim + drop the spaces, brackets and hyphens people paste from a contact
 * card. Only separators are removed — never a digit and never a letter, so
 * `validatePhone` still sees exactly what was typed.
 */
export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s()-]/g, "");
}

/** Azerbaijani error message, or null when the phone number is acceptable. */
export function validatePhone(raw: string): string | null {
  const phone = normalizePhone(raw);
  if (!phone) return "Telefon nömrəsi tələb olunur.";
  if (!phone.startsWith("+994")) return "Nömrə +994 ilə başlamalıdır.";
  if (!PHONE_RE.test(phone))
    return "Telefon nömrəsi düzgün deyil. Nümunə: +994501234567.";
  return null;
}

/** Trim + collapse inner whitespace. For names and other short free text. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Azerbaijani error message, or null when the name is acceptable. */
export function validateName(raw: string, label: string): string | null {
  const name = cleanName(raw);
  if (name.length < 2) return `${label} ən azı 2 hərf olmalıdır.`;
  if (name.length > 60) return `${label} çox uzundur.`;
  // Letters (any script), spaces, apostrophes and hyphens only — keeps control
  // characters and markup out of a value that is later rendered in the panel.
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u.test(name))
    return `${label} yalnız hərflərdən ibarət ola bilər.`;
  return null;
}
