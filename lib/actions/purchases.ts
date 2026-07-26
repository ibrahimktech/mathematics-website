"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAdmin } from "@/lib/admin/auth";
import type { ActionResult } from "./types";

/**
 * Admin purchase review. These are ADMIN writes to purchases/exam_access — tables
 * with NO student write policy — so they use the service role AFTER an
 * `isAdmin()` check, with the reviewer id taken from the verified admin session.
 *
 * Race safety: the status transition is a CONDITIONAL update
 * (`... where id = ? and status = 'pending'`). If two admins approve/deny the
 * same purchase at once, only the first update matches a row; the second sees 0
 * rows and is treated as "already handled" — no double transition, and the
 * exam_access grant is idempotent (unique on user_id+exam_id).
 */

const noteSchema = z.string().trim().max(1000).optional();

async function adminUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function approvePurchase(
  purchaseId: string,
  note?: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured || !isServiceRoleConfigured)
    return { ok: false, error: "Sistem tam konfiqurasiya edilməyib." };

  const reviewer = await adminUserId();
  if (!reviewer) return { ok: false, error: "İcazə yoxdur." };

  const admin_note = noteSchema.safeParse(note).success
    ? (note?.trim() || null)
    : null;

  const admin = createAdminClient();

  // Conditional (race-safe) transition pending → approved.
  const { data: updated, error } = await admin
    .from("purchases")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
      admin_note,
    })
    .eq("id", purchaseId)
    .eq("status", "pending")
    .select("id, user_id, exam_id");

  if (error) return { ok: false, error: "Əməliyyat alınmadı." };

  if (!updated || updated.length === 0) {
    // Already reviewed by someone else (or not pending). Not an error to retry.
    revalidatePath("/admin/purchases");
    return { ok: false, error: "Bu sorğu artıq nəzərdən keçirilib." };
  }

  const p = updated[0] as { id: string; user_id: string; exam_id: string };

  // Grant access — idempotent (unique on user_id+exam_id).
  const { error: grantErr } = await admin.from("exam_access").upsert(
    {
      user_id: p.user_id,
      exam_id: p.exam_id,
      purchase_id: p.id,
    },
    { onConflict: "user_id,exam_id", ignoreDuplicates: true },
  );
  if (grantErr) {
    // The purchase is approved but the grant failed — surface it so the admin
    // can retry; a second approve is a no-op, and the upsert will succeed.
    return { ok: false, error: "Təsdiq oldu, lakin giriş verilmədi. Yenidən cəhd edin." };
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/dashboard");
  return { ok: true, id: purchaseId };
}

export async function denyPurchase(
  purchaseId: string,
  note?: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured || !isServiceRoleConfigured)
    return { ok: false, error: "Sistem tam konfiqurasiya edilməyib." };

  const reviewer = await adminUserId();
  if (!reviewer) return { ok: false, error: "İcazə yoxdur." };

  const admin_note = noteSchema.safeParse(note).success
    ? (note?.trim() || null)
    : null;

  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("purchases")
    .update({
      status: "denied",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
      admin_note,
    })
    .eq("id", purchaseId)
    .eq("status", "pending")
    .select("id");

  if (error) return { ok: false, error: "Əməliyyat alınmadı." };
  if (!updated || updated.length === 0) {
    revalidatePath("/admin/purchases");
    return { ok: false, error: "Bu sorğu artıq nəzərdən keçirilib." };
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/dashboard");
  return { ok: true, id: purchaseId };
}
