import { createClient } from "@/lib/supabase/client";
import { ARTICLE_IMAGES_BUCKET, RESOURCES_BUCKET } from "@/lib/supabase/config";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImage(file: File): string | null {
  if (!ALLOWED.includes(file.type)) {
    return "Yalnız PNG, JPEG, WEBP və ya GIF şəkillərinə icazə verilir.";
  }
  if (file.size > MAX_BYTES) {
    return "Şəkil 5 MB-dan böyük ola bilməz.";
  }
  return null;
}

/**
 * Sniff the real image type from the magic bytes — NOT `file.type` (which the
 * OS derives from the extension) and NOT the filename. A `.png` that is really
 * something else is rejected, and the stored object's extension + Content-Type
 * come from the bytes, so the bucket can never serve a mislabelled file.
 *
 * This is a correctness/consistency check, not the authorization boundary: the
 * browser uploads straight to Storage, so the gate that actually stops a
 * non-admin is the RLS policy on `storage.objects` (`is_admin()`), same as for
 * blog images.
 */
function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return { mime: "image/png", ext: "png" };
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return { mime: "image/webp", ext: "webp" };
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
  )
    return { mime: "image/gif", ext: "gif" };
  return null;
}

/**
 * Upload an image to the `article-images` bucket and return its public URL.
 * `folder` is an optional path prefix ("" for blog images, "exam-questions/"
 * for exam question images) — one bucket, one RLS policy set, one uploader.
 * The object name is a random UUID, so a public URL is unguessable and reveals
 * nothing about the file it came from.
 */
async function uploadImage(file: File, folder: string): Promise<string> {
  const validationError = validateImage(file);
  if (validationError) throw new Error(validationError);

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffImage(head);
  if (!sniffed) {
    throw new Error("Fayl həqiqi PNG, JPEG, WEBP və ya GIF şəkli deyil.");
  }

  const supabase = createClient();
  const filename = `${crypto.randomUUID()}.${sniffed.ext}`;
  const path = `${folder}${new Date().getFullYear()}/${filename}`;

  const { error } = await supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: sniffed.mime,
    });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/** Upload an article/cover image (blog editor). */
export function uploadArticleImage(file: File): Promise<string> {
  return uploadImage(file, "");
}

/** Upload an image used inside an exam question prompt or explanation. */
export function uploadExamImage(file: File): Promise<string> {
  return uploadImage(file, "exam-questions/");
}

/* ======================= Resource library (private PDFs) ==================== */

/**
 * Max PDF size. Matches `file_size_limit` on the `resources` bucket in
 * `supabase/resources-schema.sql` — keep the two in step, since Storage enforces
 * its own copy and would otherwise reject a file this check let through.
 */
export const RESOURCE_PDF_MAX_MB = 50;
const RESOURCE_PDF_MAX_BYTES = RESOURCE_PDF_MAX_MB * 1024 * 1024;

/** Cheap pre-flight check (extension + declared type + size) for instant UX. */
export function validateResourcePdf(file: File): string | null {
  const looksPdf =
    file.type === "application/pdf" && /\.pdf$/i.test(file.name);
  if (!looksPdf) return "Yalnız PDF faylı yükləmək olar.";
  if (file.size === 0) return "Fayl boşdur.";
  if (file.size > RESOURCE_PDF_MAX_BYTES) {
    return `Fayl ${RESOURCE_PDF_MAX_MB} MB-dan böyük ola bilməz.`;
  }
  return null;
}

/** Supabase Storage errors are English and sometimes internal — translate. */
function storageErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("row-level security") || m.includes("unauthorized")) {
    return "İcazə yoxdur.";
  }
  if (m.includes("maximum allowed size") || m.includes("payload too large")) {
    return `Fayl ${RESOURCE_PDF_MAX_MB} MB-dan böyük ola bilməz.`;
  }
  if (m.includes("mime type")) return "Yalnız PDF faylı yükləmək olar.";
  return "Fayl yüklənmədi. Yenidən cəhd edin.";
}

/**
 * Upload a library PDF into the PRIVATE `resources` bucket and return its
 * storage path (`<year>/<uuid>.pdf`) — NOT a URL, because there isn't one.
 *
 * Uploaded straight from the browser, exactly like blog/exam images, for two
 * reasons: a Server Action body is capped at 6 MB here (and 4.5 MB on Vercel),
 * so a 30 MB book physically cannot be proxied through the app; and the bytes
 * should not make a detour through our server when Storage can take them
 * directly. The gate that actually stops a non-admin is therefore the RLS policy
 * on `storage.objects` (`is_admin()`), never this file.
 *
 * The object name is a random UUID with a `.pdf` extension derived from the
 * SNIFFED bytes, so a user-supplied filename never becomes a storage path
 * (no traversal, no collision, no information leak). The original name is kept
 * separately in `resources.file_name`, for display only.
 *
 * No progress percentage: supabase-js's `upload()` exposes no progress callback,
 * so the UI shows a determinate-but-unbounded "uploading" state instead of
 * inventing one.
 */
export async function uploadResourcePdf(file: File): Promise<string> {
  const validationError = validateResourcePdf(file);
  if (validationError) throw new Error(validationError);

  // "%PDF-" magic bytes. `file.type` comes from the extension on most systems,
  // so it proves nothing on its own.
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf =
    head.length >= 5 &&
    head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 &&
    head[3] === 0x46 && head[4] === 0x2d;
  if (!isPdf) throw new Error("Fayl həqiqi PDF sənədi deyil.");

  const supabase = createClient();
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.pdf`;

  const { error } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
      cacheControl: "3600",
    });
  if (error) throw new Error(storageErrorMessage(error.message));

  return path;
}
