import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { finalizeAttempt } from "@/lib/exams/submit";
import { isSameOrigin } from "@/lib/security/request";
import { consume, RATE_RULES } from "@/lib/security/rate-limit";

/**
 * Auto-submits an in-progress exam attempt when the student's page goes away —
 * tab closed, browser quit, refresh, or a navigation off the site. The runner
 * fires it from `pagehide` with `navigator.sendBeacon`, which is the only
 * request kind browsers still deliver reliably during unload, and which cannot
 * call a Server Action. Hence this route: it is the SAME `finalizeAttempt` the
 * normal "Təqdim et" button uses, reached by the only transport available.
 *
 * The attempt id in the body is NOT trusted on its own: `finalizeAttempt`
 * re-reads the row and refuses it unless it belongs to the session user, grades
 * server-side against the answer key, and only ever transitions a row that is
 * still `in_progress` — so replaying this endpoint cannot re-grade, un-submit,
 * or touch anybody else's attempt.
 *
 * Answers are merged with whatever autosave already stored, newest wins, so a
 * beacon that loses part of its payload still submits the saved answers.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured || !isServiceRoleConfigured) {
    return new NextResponse(null, { status: 503 });
  }

  /**
   * CSRF: plain route handlers do not get the Origin/Host check Next.js applies
   * to Server Actions. Without it another site could make a logged-in student's
   * browser submit their running exam.
   */
  if (!isSameOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }

  // Identity comes from the session cookie only — never from the body.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  if (!consume(`attempt-autosubmit:${user.id}`, RATE_RULES.attemptAutoSubmit).allowed) {
    return new NextResponse(null, { status: 429 });
  }

  let attemptId = "";
  let answers: unknown = {};
  try {
    const body = await request.json();
    attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
    answers = body?.answers;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const res = await finalizeAttempt(user.id, attemptId, answers);
  if (!res.ok) return new NextResponse(null, { status: 403 });

  return new NextResponse(null, { status: 204 });
}
