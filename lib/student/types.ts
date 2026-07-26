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
  status: "in_progress" | "completed";
  score: number | null;
  correct_count: number | null;
  total_count: number | null;
  answers: Record<string, number>;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
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
  | "completed"; // at least one finished attempt
