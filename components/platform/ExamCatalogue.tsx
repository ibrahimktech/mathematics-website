"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Exam } from "@/lib/exams/types";
import { difficultyLabel } from "@/lib/exams/display";
import { ExamCard } from "./ExamCard";

/**
 * Search box + card grid for /imtahanlar. The whole (already category-filtered)
 * catalogue arrives with the page, so search runs over the in-memory list —
 * a round trip per keystroke would cost far more than it saves, same reasoning
 * as `ResourceLibrary`. Category filtering stays a server-side `?kateqoriya=`
 * route concern; this component only narrows within what the server sent.
 */
export function ExamCatalogue({ exams }: { exams: Exam[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    // "az" locale is load-bearing: İ→i and I→ı, so "İntizam" matches "intizam".
    const q = query.trim().toLocaleLowerCase("az");
    if (!q) return exams;
    return exams.filter((exam) => {
      const haystack = [
        exam.title,
        exam.summary,
        exam.description,
        exam.topic,
        difficultyLabel(exam.difficulty),
        ...exam.covers,
      ];
      return haystack.some((v) => v?.toLocaleLowerCase("az").includes(q));
    });
  }, [exams, query]);

  return (
    <div>
      <div className="relative mt-6">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad və ya mövzu üzrə axtar"
          aria-label="İmtahanlarda axtar"
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px]"
        />
      </div>

      {filtered.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exam, i) => (
            <ExamCard key={exam.id} exam={exam} index={i % 6} />
          ))}
        </div>
      ) : (
        <div className="border-border text-muted-foreground bg-card mt-10 rounded-2xl border border-dashed p-16 text-center">
          Axtarışa uyğun imtahan tapılmadı.
        </div>
      )}
    </div>
  );
}
