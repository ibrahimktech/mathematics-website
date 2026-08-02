/** Domain types for private student data (mirrors supabase/exam-platform-schema.sql). */

export type PurchaseStatus = "pending" | "approved" | "denied";

export interface Purchase {
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
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface ExamAccess {
  id: string;
  user_id: string;
  exam_id: string;
  purchase_id: string | null;
  granted_at: string;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  exam_id: string;
  /**
   * `completed` IS the submitted state — the attempt has been graded and can no
   * longer be changed. (Kept under its original name so every existing read
   * keeps working; `finished_at` is the submission timestamp.)
   */
  status: "in_progress" | "completed";
  score: number | null;
  correct_count: number | null;
  total_count: number | null;
  answers: Record<string, number>;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  /**
   * 1-based ordinal within (user, exam), assigned by the database trigger in
   * `supabase/exam-attempt-limit.sql`. Nullable only so rows read before that
   * migration is applied still type-check — display code falls back to the
   * chronological position.
   */
  attempt_number: number | null;
}

/**
 * Per-exam status shown to the student — spans the purchase workflow AND the
 * attempt lifecycle. Ordered roughly by progression.
 */
export type ExamStatus =
  | "available" // published, not owned, no active request
  | "pending" // a purchase request is under review
  | "denied" // last purchase request was denied
  | "owned" // access granted (or free), not started
  | "in_progress" // an attempt is open
  | "completed" // at least one finished attempt, more attempts left
  | "exhausted"; // every allowed attempt has been used — cannot start again
