"use client";

import Link from "next/link";
import { useExamOwnership } from "@/lib/account/use-exam-ownership";
import { examStatusChipClass, examStatusLabel } from "@/lib/student/status";
import { cn } from "@/lib/utils";

const BUTTON_CLASS =
  "bg-primary text-primary-foreground hover:bg-primary-hover mt-6 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5";

/**
 * CTA region of the public exam page's purchase panel. The static HTML (and
 * every signed-out or non-owning visitor) gets the exact server-rendered
 * default: "Başla"/"İmtahanı al" into `/panel/*` — middleware bounces the
 * anonymous click to login with the target preserved. Once the client session
 * shows the exam is already owned (or the payment is pending review), the
 * button points at the panel instead of a checkout the student can't use.
 */
export function ExamPurchaseCta({
  examId,
  free,
  target,
}: {
  examId: string;
  free: boolean;
  /** Server-computed default: panel list (free) or checkout page (paid). */
  target: string;
}) {
  const ownership = useExamOwnership();
  const state =
    !free && ownership.status === "ready"
      ? ownership.ownedIds.has(examId)
        ? ("owned" as const)
        : ownership.pendingIds.has(examId)
          ? ("pending" as const)
          : null
      : null;

  if (state) {
    const chip = (
      <p className="mt-4 text-center">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
            examStatusChipClass(state),
          )}
        >
          {examStatusLabel(state)}
        </span>
      </p>
    );

    if (state === "owned") {
      return (
        <>
          {chip}
          <Link href={`/panel/imtahanlar?exam=${examId}`} className={BUTTON_CLASS}>
            Başla
          </Link>
          <p className="text-muted-foreground mt-3 text-center text-xs">
            Bu imtahan hesabında açıqdır — cəhdlərini paneldən idarə et.
          </p>
        </>
      );
    }

    return (
      <>
        {chip}
        <Link href={`/panel/odenis/${examId}`} className={BUTTON_CLASS}>
          Ödənişə bax
        </Link>
        <p className="text-muted-foreground mt-3 text-center text-xs">
          Ödənişin əl ilə yoxlanılır. Təsdiqdən sonra imtahan burada açılacaq.
        </p>
      </>
    );
  }

  return (
    <>
      <Link href={target} className={BUTTON_CLASS}>
        {free ? "Başla" : "İmtahanı al"}
      </Link>
      <p className="text-muted-foreground mt-3 text-center text-xs">
        Hesabın yoxdur?{" "}
        <Link
          href={`/qeydiyyat?redirect=${encodeURIComponent(target)}`}
          className="text-primary font-semibold"
        >
          Qeydiyyatdan keç
        </Link>
      </p>
    </>
  );
}
