/**
 * Domain types for the resource library (PDF books/handouts). CLIENT-SAFE (no
 * `server-only`) so both server pages and the client components can import
 * them. Data access lives in `lib/resources.ts` (server-only).
 *
 * These mirror `public.resources` in `supabase/resources-schema.sql`, in
 * snake_case — the same convention `Post` and `AdminPurchase` already use.
 *
 * NOTE what is deliberately ABSENT: `file_path`. The storage object name never
 * leaves the server. A client asks for a resource by `id` and the server looks
 * the path up itself, so a caller can neither read a path it wasn't given nor
 * substitute one (see `fetchResourceUrl` in `lib/actions/resources.ts`).
 */

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  /** Matches a blog category slug (see `exams.category_slug`); "" / null = none. */
  category_slug: string | null;
  /** ORIGINAL filename, for display and for the download's Content-Disposition. */
  file_name: string;
  /** Size in bytes, read back from Storage — never taken from the client. */
  file_size: number;
  created_at: string;
  updated_at: string;
}

/** How a signed URL is meant to be used: viewed inline, or saved to disk. */
export type ResourceUrlMode = "read" | "download";

/** "12,4 MB" — Azerbaijani decimal comma, matching the rest of the UI. */
export function formatFileSize(bytes: number): string {
  const n = Number(bytes) || 0;
  if (n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 0 }).format(kb)} KB`;
  const mb = kb / 1024;
  return `${new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 1 }).format(mb)} MB`;
}
