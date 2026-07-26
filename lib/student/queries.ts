import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ExamAttempt, ExamAccess, Purchase } from "./types";

/**
 * Reads of PRIVATE student data. Every query uses the request's cookie session
 * client, so Postgres RLS filters rows to the authenticated user automatically —
 * identity is never taken from the client. All degrade gracefully to empty
 * results if Supabase isn't configured OR the platform tables haven't been
 * applied yet (supabase/exam-platform-schema.sql), so pages never crash.
 */

export async function getMyPurchases(): Promise<Purchase[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as Purchase[];
  } catch {
    return [];
  }
}

export async function getMyExamAccess(): Promise<ExamAccess[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("exam_access").select("*");
    if (error) return [];
    return (data ?? []) as ExamAccess[];
  } catch {
    return [];
  }
}

/** Set of exam ids the student has an explicit access grant for (RLS-scoped). */
export async function getMyAccessExamIds(): Promise<Set<string>> {
  const access = await getMyExamAccess();
  return new Set(access.map((a) => a.exam_id));
}

export async function getMyAttempts(): Promise<ExamAttempt[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exam_attempts")
      .select("*")
      .order("started_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as ExamAttempt[];
  } catch {
    return [];
  }
}

export async function getMyCompletedAttempts(): Promise<ExamAttempt[]> {
  const attempts = await getMyAttempts();
  return attempts.filter((a) => a.status === "completed");
}

/** The current open (in-progress) attempt for an exam, if any. RLS-scoped. */
export async function getMyInProgressAttempt(
  examId: string,
): Promise<ExamAttempt | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exam_attempts")
      .select("*")
      .eq("exam_id", examId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as ExamAttempt) ?? null;
  } catch {
    return null;
  }
}

/**
 * A single attempt by id. RLS guarantees the row is returned ONLY if it belongs
 * to the authenticated user — another student's attempt id yields null.
 */
export async function getMyAttemptById(
  id: string,
): Promise<ExamAttempt | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exam_attempts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return (data as ExamAttempt) ?? null;
  } catch {
    return null;
  }
}
