import { createClient } from "@/lib/supabase/client";
import { ARTICLE_IMAGES_BUCKET } from "@/lib/supabase/config";

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

/** Upload an image to the article-images bucket and return its public URL. */
export async function uploadArticleImage(file: File): Promise<string> {
  const validationError = validateImage(file);
  if (validationError) throw new Error(validationError);

  const supabase = createClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${new Date().getFullYear()}/${filename}`;

  const { error } = await supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}
