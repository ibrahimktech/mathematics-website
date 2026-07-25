"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { slugify } from "@/lib/slug";
import { calculateReadingTime } from "@/lib/reading-time";
import { isAdmin } from "@/lib/admin/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "./types";

const PostInput = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Başlıq tələb olunur").max(300),
  slug: z.string().trim().max(120).optional(),
  excerpt: z.string().trim().max(600).optional().nullable(),
  content: z.string().default(""),
  cover_image_url: z.string().trim().optional().nullable(),
  category_id: z.string().trim().optional().nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
});

export type PostInputData = z.input<typeof PostInput>;

/** Return a slug not used by any other post. */
async function ensureUniqueSlug(
  supabase: SupabaseClient,
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  let n = 2;
  // Bounded loop; blogs never have thousands of identical slugs.
  for (let i = 0; i < 50; i++) {
    const { data } = await supabase
      .from("posts")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    const clash = (data ?? []).find(
      (r: { id: string }) => r.id !== excludeId,
    );
    if (!clash) return candidate;
    candidate = `${base}-${n++}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/meqale/[slug]", "page");
  revalidatePath("/kateqoriya/[slug]", "page");
  revalidatePath("/rss.xml");
  revalidatePath("/sitemap.xml");
}

export async function savePost(input: PostInputData): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  }

  const parsed = PostInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Yanlış məlumat.",
    };
  }
  const data = parsed.data;

  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return { ok: false, error: "İcazə yoxdur." };
  }

  const baseSlug = slugify(data.slug?.trim() ? data.slug : data.title);
  const slug = await ensureUniqueSlug(supabase, baseSlug, data.id);

  const tags = data.tags.map((t) => t.trim()).filter(Boolean);
  const cover = data.cover_image_url?.trim() || null;
  const excerpt = data.excerpt?.trim() || null;
  const category_id = data.category_id?.trim() || null;
  const reading_time_minutes = calculateReadingTime(data.content);

  const base = {
    title: data.title.trim(),
    slug,
    excerpt,
    content: data.content,
    cover_image_url: cover,
    category_id,
    tags,
    status: data.status,
    reading_time_minutes,
  };

  try {
    if (data.id) {
      // Preserve the original publish date; set it the first time it goes live.
      const { data: existing } = await supabase
        .from("posts")
        .select("published_at, status")
        .eq("id", data.id)
        .maybeSingle();

      const published_at =
        data.status === "published"
          ? ((existing?.published_at as string | null) ??
            new Date().toISOString())
          : ((existing?.published_at as string | null) ?? null);

      const { error } = await supabase
        .from("posts")
        .update({ ...base, published_at })
        .eq("id", data.id);
      if (error) throw error;

      revalidatePublic();
      return { ok: true, id: data.id, slug };
    }

    const published_at =
      data.status === "published" ? new Date().toISOString() : null;
    const { data: inserted, error } = await supabase
      .from("posts")
      .insert({ ...base, published_at })
      .select("id, slug")
      .single();
    if (error) throw error;

    revalidatePublic();
    return { ok: true, id: inserted.id as string, slug: inserted.slug as string };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Yadda saxlanmadı.",
    };
  }
}

export async function setPostStatus(
  id: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  const supabase = await createClient();
  if (!(await isAdmin(supabase)))
    return { ok: false, error: "İcazə yoxdur." };

  try {
    const { data: existing } = await supabase
      .from("posts")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    const published_at =
      status === "published"
        ? ((existing?.published_at as string | null) ??
          new Date().toISOString())
        : ((existing?.published_at as string | null) ?? null);

    const { error } = await supabase
      .from("posts")
      .update({ status, published_at })
      .eq("id", id);
    if (error) throw error;
    revalidatePublic();
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Əməliyyat alınmadı.",
    };
  }
}

export async function deletePost(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  const supabase = await createClient();
  if (!(await isAdmin(supabase)))
    return { ok: false, error: "İcazə yoxdur." };

  try {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) throw error;
    revalidatePublic();
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Silinmədi.",
    };
  }
}
