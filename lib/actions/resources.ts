"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, RESOURCES_BUCKET } from "@/lib/supabase/config";
import { isAdmin } from "@/lib/admin/auth";
import { consume, RATE_RULES } from "@/lib/security/rate-limit";
import type { ResourceUrlMode } from "@/lib/resources/types";

/**
 * Resource-library actions.
 *
 * ADMIN WRITES (create / update / replace / delete) re-check `isAdmin(supabase)`
 * before touching anything, then write with the COOKIE client so RLS
 * (`is_admin()`) is a second, database-level gate. No service-role key is
 * involved anywhere in this feature: every operation is performed by a real,
 * verified session, so Postgres and Storage can judge it themselves.
 *
 * STUDENT READS get a short-lived SIGNED URL — the bucket is private and has no
 * public URL. The caller passes a resource **id**, never a storage path: the
 * path is looked up server-side from the row, so there is nothing to tamper
 * with (no IDOR, no traversal) and the internal object name never reaches the
 * browser.
 *
 * ORPHAN POLICY (see each function for the exact ordering):
 *   create  — file is already uploaded; if the metadata INSERT fails we delete
 *             the file, so a failed create leaves nothing behind.
 *   replace — upload new → point the row at it → delete the old one. The old
 *             file is only removed once the row can no longer reference it.
 *   delete  — remove the file FIRST, then the row. Removal is verified (see
 *             `removeFile`) and re-reads as "already gone" on a second run, so a
 *             failed row-delete is simply retried; the reverse order would leave
 *             a row pointing at nothing, with nothing left in the UI to retry.
 */

/**
 * Like `ActionResult`, plus a `warning` for operations that SUCCEEDED but left
 * something untidy behind (a replaced PDF that could not be deleted). Reporting
 * that as `ok: false` would be a lie — the resource works — and swallowing it
 * would hide a real storage leak, so it gets its own channel.
 */
export type ResourceResult =
  | { ok: true; id?: string; warning?: string }
  | { ok: false; error: string };

/* --------------------------------------------------------------- validation */

/**
 * The object name our uploader produces: `<year>/<uuid>.pdf`. Anchored, so a
 * path with `..`, extra segments, a different extension or anything else the
 * client invented is rejected before it can be stored — the DB row must never
 * be able to address an object outside the shape we control.
 */
const STORAGE_PATH_RE =
  /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

const MetadataInput = z.object({
  title: z.string().trim().min(1, "Başlıq tələb olunur").max(200),
  author: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  category_slug: z.string().trim().max(120).optional().nullable(),
});

const FileInput = z.object({
  file_path: z.string().trim().regex(STORAGE_PATH_RE, "Fayl yolu düzgün deyil."),
  file_name: z.string().trim().min(1).max(300),
});

const CreateInput = MetadataInput.extend(FileInput.shape);
const UpdateInput = MetadataInput.extend({ id: z.string().uuid() });
const ReplaceInput = FileInput.extend({ id: z.string().uuid() });

export type ResourceMetadataInput = z.input<typeof MetadataInput>;
export type CreateResourceInput = z.input<typeof CreateInput>;
export type UpdateResourceInput = z.input<typeof UpdateInput>;
export type ReplaceResourceFileInput = z.input<typeof ReplaceInput>;

/**
 * The original filename, made safe for display AND for the download's
 * Content-Disposition. Everything outside a conservative allow-list becomes
 * "-", so no separators, quotes, newlines or control characters survive. This
 * value is never used to address storage — only `file_path` is.
 */
function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  const cleaned = base
    // Keep letters (incl. Azerbaijani), digits and a few harmless separators.
    .replace(/[^\p{L}\p{N} ._()-]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 120);
  const named = cleaned || "resurs";
  return /\.pdf$/i.test(named) ? named : `${named}.pdf`;
}

function notReady(): ResourceResult {
  return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
}

/** The cookie client, but only once the caller is confirmed to be an admin. */
async function adminClient(): Promise<
  { ok: true; supabase: SupabaseClient } | { ok: false; error: string }
> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "İcazə yoxdur." };
  return { ok: true, supabase };
}

type StoredObject = {
  name: string;
  metadata: { size?: number; mimetype?: string } | null;
};

/**
 * Look one object up by its exact name. Returns `null` when Storage could not
 * be asked at all — "we don't know" is a third state that must not be confused
 * with "it isn't there", because the callers below make destructive decisions
 * from this answer.
 */
async function findObject(
  supabase: SupabaseClient,
  path: string,
): Promise<{ known: true; object: StoredObject | null } | { known: false }> {
  const slash = path.indexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  try {
    const { data, error } = await supabase.storage
      .from(RESOURCES_BUCKET)
      // `search` is a prefix match, so still compare the name exactly.
      .list(folder, { search: name, limit: 1 });
    if (error) return { known: false };
    const object = ((data ?? []) as StoredObject[]).find((o) => o.name === name);
    return { known: true, object: object ?? null };
  } catch {
    return { known: false };
  }
}

/**
 * Confirm an uploaded object really exists and read its REAL size back from
 * Storage. The client reports neither — a browser-supplied size would be
 * decorative at best and a lie at worst — and this also catches a metadata step
 * replayed with a path whose upload never happened.
 */
async function statUploadedPdf(
  supabase: SupabaseClient,
  path: string,
): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  const probe = await findObject(supabase, path);
  if (!probe.known) {
    return { ok: false, error: "Fayl yoxlanmadı. Yenidən cəhd edin." };
  }
  if (!probe.object) {
    return { ok: false, error: "Yüklənmiş fayl tapılmadı. Yenidən yükləyin." };
  }
  const meta = probe.object.metadata;
  if (meta?.mimetype && meta.mimetype !== "application/pdf") {
    return { ok: false, error: "Yalnız PDF faylı yükləmək olar." };
  }
  return { ok: true, size: Number(meta?.size ?? 0) };
}

/**
 * Remove an object and CONFIRM it is gone. True means "definitely not there any
 * more" — which is the only claim the callers can safely act on.
 *
 * The result of `remove()` alone is not that claim. Storage answers
 * `{ data: [], error: null }` both when a policy silently refused the delete and
 * when the object was already absent, so trusting it would let `deleteResource`
 * drop the row while the file survived. Verifying afterwards also makes a retry
 * work: an object removed by an earlier half-finished run reads as gone, so the
 * second attempt proceeds to the database instead of refusing forever.
 *
 * If Storage cannot be reached to verify, the answer is false — reporting an
 * untidy state is better than deleting a row whose PDF may still exist.
 */
async function removeFile(
  supabase: SupabaseClient,
  path: string,
): Promise<boolean> {
  try {
    await supabase.storage.from(RESOURCES_BUCKET).remove([path]);
  } catch {
    // Fall through: the verification below decides, not the call's outcome.
  }
  const probe = await findObject(supabase, path);
  return probe.known ? probe.object === null : false;
}

function revalidateResources(): void {
  revalidatePath("/admin/resources");
  revalidatePath("/resurslar");
}

/* ------------------------------------------------------------- admin writes */

/**
 * Record a PDF that has just been uploaded to the private bucket.
 *
 * The bytes are already in Storage (the browser sent them there directly — see
 * `uploadResourcePdf`), so this step is metadata only. If the INSERT fails, the
 * uploaded file is deleted, so a failed create leaves no orphan.
 */
export async function createResource(
  input: CreateResourceInput,
): Promise<ResourceResult> {
  if (!isSupabaseConfigured) return notReady();

  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat." };
  }
  const data = parsed.data;

  const auth = await adminClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const stat = await statUploadedPdf(supabase, data.file_path);
  if (!stat.ok) {
    // The row was never created, so nothing references the file. If something
    // IS there under that path, drop it rather than leaving it unreferenced.
    await removeFile(supabase, data.file_path);
    return { ok: false, error: stat.error };
  }

  const { data: inserted, error } = await supabase
    .from("resources")
    .insert({
      title: data.title.trim(),
      author: data.author?.trim() || null,
      description: data.description?.trim() || null,
      category_slug: data.category_slug?.trim() || null,
      file_path: data.file_path,
      file_name: safeFileName(data.file_name),
      file_size: stat.size,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // ORPHAN CLEANUP: storage succeeded, the database did not.
    const removed = await removeFile(supabase, data.file_path);
    return {
      ok: false,
      error: removed
        ? "Resurs yadda saxlanmadı. Yenidən cəhd edin."
        : "Resurs yadda saxlanmadı və yüklənmiş fayl silinmədi. Yenidən cəhd edin.",
    };
  }

  revalidateResources();
  return { ok: true, id: inserted.id as string };
}

/** Edit the metadata of an existing resource. The PDF is untouched. */
export async function updateResource(
  input: UpdateResourceInput,
): Promise<ResourceResult> {
  if (!isSupabaseConfigured) return notReady();

  const parsed = UpdateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat." };
  }
  const data = parsed.data;

  const auth = await adminClient();
  if (!auth.ok) return auth;

  const { data: updated, error } = await auth.supabase
    .from("resources")
    .update({
      title: data.title.trim(),
      author: data.author?.trim() || null,
      description: data.description?.trim() || null,
      category_slug: data.category_slug?.trim() || null,
    })
    .eq("id", data.id)
    .select("id");

  if (error) return { ok: false, error: "Yadda saxlanmadı." };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Resurs tapılmadı." };
  }

  revalidateResources();
  return { ok: true, id: data.id };
}

/**
 * Swap in a newly uploaded PDF, keeping the metadata.
 *
 * Order matters: the row is pointed at the NEW file before the OLD one is
 * removed, so a failure at any step leaves a resource whose PDF still opens.
 * Deleting first would risk losing the document entirely if the update failed.
 */
export async function replaceResourceFile(
  input: ReplaceResourceFileInput,
): Promise<ResourceResult> {
  if (!isSupabaseConfigured) return notReady();

  const parsed = ReplaceInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat." };
  }
  const data = parsed.data;

  const auth = await adminClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const { data: existing, error: readErr } = await supabase
    .from("resources")
    .select("id, file_path")
    .eq("id", data.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: "Resurs oxunmadı." };
  if (!existing) {
    // Nothing to attach the upload to — don't leave it lying in the bucket.
    await removeFile(supabase, data.file_path);
    return { ok: false, error: "Resurs tapılmadı." };
  }

  const oldPath = (existing as { file_path: string }).file_path;
  if (oldPath === data.file_path) {
    return { ok: false, error: "Yeni fayl köhnə fayl ilə eynidir." };
  }

  const stat = await statUploadedPdf(supabase, data.file_path);
  if (!stat.ok) {
    await removeFile(supabase, data.file_path);
    return { ok: false, error: stat.error };
  }

  const { data: updated, error } = await supabase
    .from("resources")
    .update({
      file_path: data.file_path,
      file_name: safeFileName(data.file_name),
      file_size: stat.size,
    })
    .eq("id", data.id)
    .select("id");

  if (error || !updated || updated.length === 0) {
    // The row still points at the OLD file, which is intact — undo the upload.
    await removeFile(supabase, data.file_path);
    return { ok: false, error: "Fayl əvəz olunmadı. Köhnə fayl qüvvədə qalır." };
  }

  // The row no longer references the old object, so it can go. If it doesn't,
  // the replacement still succeeded — say so, and say what was left behind.
  const removed = await removeFile(supabase, oldPath);

  revalidateResources();
  return removed
    ? { ok: true, id: data.id }
    : {
        ok: true,
        id: data.id,
        warning: "Yeni fayl qüvvədədir, lakin köhnə fayl anbardan silinmədi.",
      };
}

/**
 * Delete a resource, file and row.
 *
 * The FILE goes first, and `removeFile` only reports success once the object is
 * confirmed gone — so the row is never dropped while the PDF survives. If the
 * row delete then fails, the admin presses Sil again: the file already reads as
 * absent, so the retry falls straight through to the database. The opposite
 * order would leave a row pointing at nothing, with no way to retry from the UI.
 */
export async function deleteResource(id: string): Promise<ResourceResult> {
  if (!isSupabaseConfigured) return notReady();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Resurs tapılmadı." };
  }

  const auth = await adminClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const { data: existing, error: readErr } = await supabase
    .from("resources")
    .select("id, file_path")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: "Resurs oxunmadı." };
  if (!existing) return { ok: false, error: "Resurs tapılmadı." };

  const path = (existing as { file_path: string }).file_path;

  if (!(await removeFile(supabase, path))) {
    // Nothing has changed — the resource is still whole and still listed.
    return {
      ok: false,
      error: "Fayl anbardan silinmədi, ona görə resurs saxlanıldı. Yenidən cəhd edin.",
    };
  }

  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) {
    revalidateResources();
    return {
      ok: false,
      error: "Fayl silindi, lakin qeyd silinmədi. Yenidən “Sil” düyməsinə basın.",
    };
  }

  revalidateResources();
  return { ok: true, id };
}

/* ------------------------------------------------- signed URLs (any student) */

/** One hour — long enough to read a book in the browser's PDF viewer. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type ResourceUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Mint a short-lived signed URL for one resource.
 *
 * Authorization is the database's, not this function's: the row is read with
 * the caller's cookie session, so RLS returns it only to an authenticated user,
 * and the signing request itself passes the same SELECT policy on
 * `storage.objects`. An anonymous caller gets no row and therefore no URL.
 *
 * `mode: "download"` adds a Content-Disposition filename so the browser saves
 * the file instead of rendering it; "read" opens it in the native PDF viewer.
 * Either way the bytes travel from Supabase to the browser directly — the app
 * server never proxies the PDF.
 */
export async function fetchResourceUrl(
  id: string,
  mode: ResourceUrlMode = "read",
): Promise<ResourceUrlResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  }
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Resurs tapılmadı." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Əvvəlcə daxil olun." };

  // Signing is cheap, but not free — stop one account from looping on it.
  if (!consume(`resource-url:${user.id}`, RATE_RULES.resourceUrl).allowed) {
    return { ok: false, error: "Çox sayda sorğu. Bir az sonra yenidən cəhd edin." };
  }

  // RLS decides whether this row is visible at all. The client never sends a
  // path — it comes from here.
  const { data: row, error } = await supabase
    .from("resources")
    .select("file_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: "Resurs açılmadı." };
  if (!row) return { ok: false, error: "Resurs tapılmadı." };

  const { file_path, file_name } = row as {
    file_path: string;
    file_name: string;
  };

  try {
    const { data, error: signErr } = await supabase.storage
      .from(RESOURCES_BUCKET)
      .createSignedUrl(
        file_path,
        SIGNED_URL_TTL_SECONDS,
        mode === "download" ? { download: safeFileName(file_name) } : undefined,
      );
    if (signErr || !data?.signedUrl) {
      return { ok: false, error: "Fayl açılmadı. Yenidən cəhd edin." };
    }
    return { ok: true, url: data.signedUrl };
  } catch {
    return { ok: false, error: "Fayl açılmadı. Yenidən cəhd edin." };
  }
}
