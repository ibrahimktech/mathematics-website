"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { slugify } from "@/lib/slug";
import { isAdmin } from "@/lib/admin/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "./types";

const CategoryInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Ad tələb olunur").max(120),
  slug: z.string().trim().max(120).optional(),
  emoji: z.string().trim().max(8).optional().nullable(),
  description: z.string().trim().max(400).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
});

export type CategoryInputData = z.input<typeof CategoryInput>;

async function ensureUniqueSlug(
  supabase: SupabaseClient,
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  let n = 2;
  for (let i = 0; i < 50; i++) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    const clash = (data ?? []).find((r: { id: string }) => r.id !== excludeId);
    if (!clash) return candidate;
    candidate = `${base}-${n++}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function revalidateCategoryUsage() {
  revalidatePath("/");
  revalidatePath("/kateqoriya/[slug]", "page");
  revalidatePath("/admin/categories");
}

export async function saveCategory(
  input: CategoryInputData,
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };

  const parsed = CategoryInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Yanlış məlumat.",
    };
  }
  const data = parsed.data;

  const supabase = await createClient();
  if (!(await isAdmin(supabase)))
    return { ok: false, error: "İcazə yoxdur." };

  const baseSlug = slugify(data.slug?.trim() ? data.slug : data.name);
  const slug = await ensureUniqueSlug(supabase, baseSlug, data.id);

  const row = {
    name: data.name.trim(),
    slug,
    emoji: data.emoji?.trim() || null,
    description: data.description?.trim() || null,
    sort_order: data.sort_order ?? 0,
  };

  try {
    if (data.id) {
      const { error } = await supabase
        .from("categories")
        .update(row)
        .eq("id", data.id);
      if (error) throw error;
      revalidateCategoryUsage();
      return { ok: true, id: data.id, slug };
    }
    const { data: inserted, error } = await supabase
      .from("categories")
      .insert(row)
      .select("id, slug")
      .single();
    if (error) throw error;
    revalidateCategoryUsage();
    return { ok: true, id: inserted.id as string, slug: inserted.slug as string };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Yadda saxlanmadı.",
    };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  const supabase = await createClient();
  if (!(await isAdmin(supabase)))
    return { ok: false, error: "İcazə yoxdur." };

  try {
    // Posts in this category keep existing (FK is ON DELETE SET NULL).
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
    revalidateCategoryUsage();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Silinmədi." };
  }
}
