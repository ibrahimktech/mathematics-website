"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useExamOwnership } from "@/lib/account/use-exam-ownership";

/**
 * Footer action of the PUBLIC exam card. Default (static HTML, signed-out,
 * non-owner) is the plain "Ətraflı" hint — not a link, so clicks fall through
 * to the card's stretched link onto the exam page. When the client session
 * shows the visitor may take the exam (owns it, or it's free), it becomes a
 * real link into the panel — `relative z-10` lifts it above the stretched
 * link's `after:` overlay so it wins the click.
 */
export function ExamCardAction({
  examId,
  free,
}: {
  examId: string;
  free: boolean;
}) {
  const ownership = useExamOwnership();
  const mine =
    ownership.status === "ready" && (free || ownership.ownedIds.has(examId));

  if (mine) {
    return (
      <Link
        href={`/panel/imtahanlar?exam=${examId}`}
        className="text-primary relative z-10 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
      >
        {free ? "Başla" : "Panelə keç"}
        <ArrowRight className="size-4" />
      </Link>
    );
  }

  return (
    <span className="text-primary inline-flex items-center gap-1 text-sm font-semibold">
      Ətraflı
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </span>
  );
}
