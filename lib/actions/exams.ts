"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { slugify } from "@/lib/slug";
import { isAdmin } from "@/lib/admin/auth";
import type { ActionResult } from "./types";

/**
 * Admin exam + question actions. Every action re-checks `isAdmin(supabase)` (so
 * a non-admin calling the action directly is rejected regardless of any UI) and
 * validates with zod. Writes use the cookie client, so RLS (`is_admin()`) is a
 * second, database-level gate.
 */

const ExamInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Ad tələb olunur").max(200),
  slug: z.string().trim().max(120).optional(),
  summary: z.string().trim().max(400).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  category_slug: z.string().trim().max(120).optional().nullable(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "olympiad"]),
  price: z.coerce.number().min(0).max(100000),
  currency: z.string().trim().min(1).max(8).default("AZN"),
  duration_minutes: z.coerce.number().int().min(0).max(100000),
  covers: z.array(z.string().trim()).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});
export type ExamInputData = z.input<typeof ExamInput>;

const QuestionInput = z
  .object({
    id: z.string().uuid().optional(),
    exam_id: z.string().uuid(),
    prompt: z.string().trim().min(1, "Sual mətni tələb olunur").max(4000),
    choices: z
      .array(z.string().trim().min(1, "Boş variant ola bilməz").max(2000))
      .min(2, "Ən azı iki variant lazımdır")
      .max(8),
    correct_index: z.coerce.number().int().min(0),
    explanation: z.string().trim().max(4000).optional().nullable(),
  })
  /**
   * The answer index must actually point at one of the choices. The table check
   * constraint only enforces `>= 0`, so an out-of-range index used to be stored
   * happily — and then `gradeExam` could never match it, silently making the
   * question unanswerable and every student's score wrong.
   */
  .refine((q) => q.correct_index < q.choices.length, {
    path: ["correct_index"],
    message: "Düzgün cavab variantlardan biri olmalıdır.",
  });
export type QuestionInputData = z.input<typeof QuestionInput>;

/** A complete catalogue order: every exam id exactly once, first to last. */
const ReorderInput = z
  .array(z.string().uuid())
  .min(1, "Sıralanacaq imtahan yoxdur.")
  .max(1000)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Siyahıda təkrarlanan imtahan var.",
  });

async function requireAdmin(
  supabase: SupabaseClient,
): Promise<ActionResult | null> {
  if (!(await isAdmin(supabase))) return { ok: false, error: "İcazə yoxdur." };
  return null;
}

async function ensureUniqueSlug(
  supabase: SupabaseClient,
  base: string,
  excludeId?: string,
): Promise<string> {
  const cleanBase = base || "imtahan";
  let candidate = cleanBase;
  let n = 2;
  for (let i = 0; i < 50; i++) {
    const { data } = await supabase
      .from("exams")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    const clash = (data ?? []).find((r: { id: string }) => r.id !== excludeId);
    if (!clash) return candidate;
    candidate = `${cleanBase}-${n++}`;
  }
  return `${cleanBase}-${Date.now().toString(36)}`;
}

function revalidateExamPublic() {
  revalidatePath("/");
  revalidatePath("/imtahanlar");
  revalidatePath("/imtahanlar/[slug]", "page");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/exams");
}

/**
 * Persist a new CATALOGUE order (exam ids, first to last).
 *
 * `saveExam` never writes `display_order` and this never writes anything else,
 * so editing an exam can't move it and reordering can't edit it. A new exam gets
 * `max + 1` from a DB trigger and lands at the bottom until dragged.
 *
 * The whole order goes over as ONE rpc call, which runs ONE
 * `update … from unnest(…) with ordinality` — atomic, so a failure leaves the
 * previous order completely intact rather than half-renumbered. The RPC
 * re-checks `is_admin()` itself and rejects any list that isn't a permutation of
 * every exam. See `supabase/exam-display-order.sql`.
 */
export async function reorderExams(
  orderedIds: string[],
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };

  const parsed = ReorderInput.safeParse(orderedIds);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat." };
  }

  const supabase = await createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  try {
    const { error } = await supabase.rpc("reorder_exams", { p_ids: parsed.data });
    if (error) throw error;
    revalidateExamPublic();
    revalidatePath("/admin/exams/siralama");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    // Raised by the RPC when the submitted list no longer covers every exam —
    // i.e. one was created or deleted while the reorder page was open.
    if (message.includes("stale exam order")) {
      return {
        ok: false,
        error:
          "Siyahı köhnəlib — imtahan əlavə olunub və ya silinib. Səhifəni yeniləyib yenidən cəhd edin.",
      };
    }
    return { ok: false, error: message || "Sıralama yadda saxlanmadı." };
  }
}

export async function saveExam(input: ExamInputData): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };

  const parsed = ExamInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const baseSlug = slugify(data.slug?.trim() ? data.slug : data.title);
  const slug = await ensureUniqueSlug(supabase, baseSlug, data.id);

  const row = {
    title: data.title.trim(),
    slug,
    summary: data.summary?.trim() || null,
    description: data.description?.trim() || null,
    category_slug: data.category_slug?.trim() || null,
    difficulty: data.difficulty,
    price: data.price,
    currency: data.currency.trim() || "AZN",
    duration_minutes: data.duration_minutes,
    covers: data.covers.map((c) => c.trim()).filter(Boolean),
    featured: data.featured,
    status: data.status,
  };

  try {
    if (data.id) {
      const { error } = await supabase.from("exams").update(row).eq("id", data.id);
      if (error) throw error;
      revalidateExamPublic();
      return { ok: true, id: data.id, slug };
    }
    const { data: inserted, error } = await supabase
      .from("exams")
      .insert(row)
      .select("id, slug")
      .single();
    if (error) throw error;
    revalidateExamPublic();
    return { ok: true, id: inserted.id as string, slug: inserted.slug as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Yadda saxlanmadı." };
  }
}

export async function setExamStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  const supabase = await createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;
  try {
    const { error } = await supabase.from("exams").update({ status }).eq("id", id);
    if (error) throw error;
    revalidateExamPublic();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Əməliyyat alınmadı." };
  }
}

export async function deleteExam(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  const supabase = await createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;
  try {
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) throw error;
    revalidateExamPublic();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Silinmədi." };
  }
}

/* ------------------------------- Questions -------------------------------- */

export async function saveQuestion(
  input: QuestionInputData,
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };

  const parsed = QuestionInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat." };
  }
  const data = parsed.data;
  if (data.correct_index >= data.choices.length) {
    return { ok: false, error: "Düzgün cavab variantlardan biri olmalıdır." };
  }

  const supabase = await createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const base = {
    exam_id: data.exam_id,
    prompt: data.prompt.trim(),
    choices: data.choices.map((c) => c.trim()),
    correct_index: data.correct_index,
    explanation: data.explanation?.trim() || null,
  };

  try {
    if (data.id) {
      const { error } = await supabase
        .from("exam_questions")
        .update(base)
        .eq("id", data.id);
      if (error) throw error;
      revalidatePath(`/admin/exams/${data.exam_id}/edit`);
      return { ok: true, id: data.id };
    }
    // New question → append at the end.
    const { data: last } = await supabase
      .from("exam_questions")
      .select("position")
      .eq("exam_id", data.exam_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = ((last?.position as number | undefined) ?? -1) + 1;
    const { data: inserted, error } = await supabase
      .from("exam_questions")
      .insert({ ...base, position })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath(`/admin/exams/${data.exam_id}/edit`);
    revalidateExamPublic();
    return { ok: true, id: inserted.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Yadda saxlanmadı." };
  }
}

export async function deleteQuestion(
  id: string,
  examId: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  const supabase = await createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;
  try {
    const { error } = await supabase.from("exam_questions").delete().eq("id", id);
    if (error) throw error;
    revalidatePath(`/admin/exams/${examId}/edit`);
    revalidateExamPublic();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Silinmədi." };
  }
}

/** Persist a new question order (array of question ids in the desired order). */
export async function reorderQuestions(
  examId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  const supabase = await createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from("exam_questions")
        .update({ position: i })
        .eq("id", orderedIds[i])
        .eq("exam_id", examId);
      if (error) throw error;
    }
    revalidatePath(`/admin/exams/${examId}/edit`);
    return { ok: true, id: examId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sıralanmadı." };
  }
}
