import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/account/auth";
import { getExamById } from "@/lib/exams";
import { getStudentExamQuestions } from "@/lib/exams/questions";
import { getMyInProgressAttempt } from "@/lib/student/queries";
import { MAX_EXAM_ATTEMPTS } from "@/lib/student/status";
import { ExamRunner } from "@/components/platform/ExamRunner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TakeExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("/panel"); // per-page gate (defense in depth)
  const { id } = await params;

  const exam = await getExamById(id);
  if (!exam) notFound();

  // Must have an open attempt (created via the Start action, which verifies
  // access AND the remaining-attempts limit). If not, send them to the exam
  // entry to start it properly — this URL can never start one by itself, so a
  // student who has used every attempt cannot come back in through it.
  const attempt = await getMyInProgressAttempt(id);
  if (!attempt) redirect(`/panel/imtahanlar?exam=${id}`);

  // Questions come from get_exam_questions() — returns [] unless the caller has
  // access (published + free/granted). So this is ALSO an access gate: no rows
  // ⇒ either access was lost or questions aren't ready.
  const questions = await getStudentExamQuestions(id);
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="exam-title text-foreground text-2xl font-bold">
          {exam.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Bu imtahanın sualları hazırlanır və ya girişiniz aktiv deyil.
        </p>
        <Link
          href="/panel/imtahanlar"
          className="text-primary mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          <ArrowLeft className="size-4" /> İmtahanlara qayıt
        </Link>
      </div>
    );
  }

  // `?? null` normalizes the `undefined` this column reads back as until
  // supabase/exam-attempt-limit.sql has been applied.
  const attemptNumber = attempt.attempt_number ?? null;

  return (
    <ExamRunner
      examTitle={exam.title}
      durationMinutes={exam.durationMinutes}
      questions={questions}
      attemptId={attempt.id}
      startedAt={attempt.started_at}
      initialAnswers={attempt.answers ?? {}}
      attemptNumber={attemptNumber}
      attemptLimit={MAX_EXAM_ATTEMPTS}
    />
  );
}
