import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import type { PurchaseStatus } from "@/lib/student/types";

/**
 * Admin reads of purchases, joined with the student profile + exam. Uses the
 * cookie session client under RLS — admins have SELECT on purchases, profiles
 * and exams (all via `is_admin()`), so no service role is needed for reads.
 * `purchases.user_id` has no FK to `profiles`, so profiles are fetched
 * separately and merged (both reference auth.users).
 */

export interface AdminPurchase {
  id: string;
  user_id: string;
  exam_id: string;
  amount: number;
  currency: string;
  status: PurchaseStatus;
  receipt_path: string | null;
  receipt_unavailable: boolean;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  exam: { title: string; slug: string } | null;
  student: {
    student_number: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const PURCHASE_SELECT =
  "id,user_id,exam_id,amount,currency,status,receipt_path,receipt_unavailable,admin_note,created_at,reviewed_at,reviewed_by,exam:exams(title,slug)";

export async function getPurchasesAdmin(
  status?: PurchaseStatus,
): Promise<AdminPurchase[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    let query = supabase
      .from("purchases")
      .select(PURCHASE_SELECT)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as AdminPurchase[];

    // Merge in student profiles (separate query — no FK to purchases).
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, student_number, full_name, first_name, last_name, email")
        .in("id", userIds);
      const map = new Map(
        (profiles ?? []).map((p) => [
          (p as { id: string }).id,
          p as AdminPurchase["student"] & { id: string },
        ]),
      );
      for (const r of rows) r.student = map.get(r.user_id) ?? null;
    }
    return rows;
  } catch {
    return [];
  }
}

/** Counts by status for the dashboard. */
export async function getPurchaseCounts(): Promise<{
  pending: number;
  approved: number;
  denied: number;
}> {
  if (!isSupabaseConfigured) return { pending: 0, approved: 0, denied: 0 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("purchases").select("status");
    if (error) throw error;
    const rows = (data ?? []) as { status: PurchaseStatus }[];
    return {
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      denied: rows.filter((r) => r.status === "denied").length,
    };
  } catch {
    return { pending: 0, approved: 0, denied: 0 };
  }
}

/**
 * A short-lived signed URL for a receipt, generated with the admin's own
 * session (storage RLS allows admins to read any receipt). Returns null unless
 * the caller is an admin — defense in depth around the storage policy.
 */
export async function getReceiptSignedUrl(
  path: string,
): Promise<string | null> {
  if (!isSupabaseConfigured || !path) return null;
  try {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) return null;
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 120); // 2 minutes
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
