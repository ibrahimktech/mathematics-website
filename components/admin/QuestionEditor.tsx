"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Tex } from "@/components/platform/Tex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LatexImageField } from "./LatexImageField";
import {
  saveQuestion,
  deleteQuestion,
  reorderQuestions,
} from "@/lib/actions/exams";
import type { AdminExamQuestion } from "@/lib/exams/types";
import { cn } from "@/lib/utils";

type Draft = {
  id?: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

function emptyDraft(): Draft {
  return { prompt: "", choices: ["", ""], correctIndex: 0, explanation: "" };
}

function toDraft(q: AdminExamQuestion): Draft {
  return {
    id: q.id,
    prompt: q.prompt,
    choices: q.choices.length ? q.choices : ["", ""],
    correctIndex: q.correctIndex ?? 0,
    explanation: q.explanation ?? "",
  };
}

/**
 * Add / edit / delete / reorder questions for one exam. The question list is
 * server-provided (`questions`); every mutation calls a server action and then
 * `router.refresh()` so the UI reflects the DB truth. LaTeX is previewed live
 * with the same `Tex` renderer used on the public site → what you preview is
 * what students see.
 *
 * Images live inside the same LaTeX strings as `\includegraphics{<public URL>}`
 * (see `LatexImageField`), so there is no second content format and no schema
 * change — a question is still just prompt + choices + explanation.
 */
export function QuestionEditor({
  examId,
  questions,
}: {
  examId: string;
  questions: AdminExamQuestion[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function startNew() {
    setDraft(emptyDraft());
    setOpenId("new");
  }
  function startEdit(q: AdminExamQuestion) {
    setDraft(toDraft(q));
    setOpenId(q.id);
  }
  function cancel() {
    setOpenId(null);
    setDraft(emptyDraft());
  }

  async function save() {
    if (!draft.prompt.trim()) {
      toast.error("Sual mətni tələb olunur");
      return;
    }
    const choices = draft.choices.map((c) => c.trim());
    if (choices.some((c) => !c)) {
      toast.error("Bütün variantları doldurun");
      return;
    }
    if (choices.length < 2) {
      toast.error("Ən azı iki variant lazımdır");
      return;
    }
    setSaving(true);
    const res = await saveQuestion({
      id: draft.id,
      exam_id: examId,
      prompt: draft.prompt,
      choices,
      correct_index: draft.correctIndex,
      explanation: draft.explanation,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(draft.id ? "Sual yeniləndi" : "Sual əlavə olundu");
    cancel();
    router.refresh();
  }

  async function remove(q: AdminExamQuestion) {
    if (!window.confirm("Bu sualı silmək istədiyinizə əminsiniz?")) return;
    setBusyId(q.id);
    const res = await deleteQuestion(q.id, examId);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Sual silindi");
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= questions.length) return;
    const ids = questions.map((q) => q.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setBusyId(questions[index].id);
    const res = await reorderQuestions(examId, ids);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="exam-title text-foreground text-xl font-bold tracking-tight">
            Suallar
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {questions.length} sual · LaTeX ($…$ və ya \[ … \]) və şəkil
            dəstəklənir.
          </p>
        </div>
        {openId !== "new" && (
          <Button size="sm" onClick={startNew}>
            <Plus /> Sual əlavə et
          </Button>
        )}
      </div>

      {/* New-question form */}
      {openId === "new" && (
        <div className="mt-4">
          <QuestionForm
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onCancel={cancel}
            saving={saving}
          />
        </div>
      )}

      {/* Question list */}
      <div className="mt-4 space-y-3">
        {questions.map((q, i) =>
          openId === q.id ? (
            <QuestionForm
              key={q.id}
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={cancel}
              saving={saving}
            />
          ) : (
            <div
              key={q.id}
              className="border-border bg-card rounded-xl border p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    aria-label="Yuxarı"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || busyId !== null}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <span className="text-muted-foreground text-xs font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Aşağı"
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1 || busyId !== null}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <Tex className="tex-compact text-foreground text-sm font-medium">
                    {q.prompt}
                  </Tex>
                  <ul className="mt-2 space-y-1">
                    {q.choices.map((c, ci) => (
                      <li
                        key={ci}
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          ci === q.correctIndex
                            ? "text-emerald-700"
                            : "text-muted-foreground",
                        )}
                      >
                        <span className="font-bold">
                          {String.fromCharCode(65 + ci)}.
                        </span>
                        <Tex className="flex-1">{c}</Tex>
                        {ci === q.correctIndex && (
                          <Check className="size-3.5 shrink-0" />
                        )}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && (
                    <p className="text-muted-foreground mt-2 line-clamp-1 text-xs italic">
                      Həll: {q.explanation}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Redaktə et"
                    onClick={() => startEdit(q)}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Sil"
                    onClick={() => remove(q)}
                    disabled={busyId === q.id}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md p-1.5"
                  >
                    {busyId === q.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ),
        )}

        {questions.length === 0 && openId !== "new" && (
          <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            Hələ sual yoxdur. “Sual əlavə et” ilə başlayın.
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  function setChoice(i: number, v: string) {
    const choices = [...draft.choices];
    choices[i] = v;
    setDraft({ ...draft, choices });
  }
  function addChoice() {
    if (draft.choices.length >= 8) return;
    setDraft({ ...draft, choices: [...draft.choices, ""] });
  }
  function removeChoice(i: number) {
    if (draft.choices.length <= 2) return;
    const choices = draft.choices.filter((_, idx) => idx !== i);
    const correctIndex =
      draft.correctIndex === i
        ? 0
        : draft.correctIndex > i
          ? draft.correctIndex - 1
          : draft.correctIndex;
    setDraft({ ...draft, choices, correctIndex });
  }

  return (
    <div className="border-primary/30 bg-card ring-primary/10 rounded-xl border p-4 ring-2 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <LatexImageField
            id="q-prompt"
            label="Sual mətni (LaTeX)"
            value={draft.prompt}
            onChange={(v) => setDraft({ ...draft, prompt: v })}
            rows={3}
            placeholder="Məsələn: $x^2 - 5x + 6 = 0$ tənliyinin köklərinin cəmi neçədir?"
          />
          <p className="text-muted-foreground mt-1.5 text-xs">Önizləmə:</p>
          <div className="border-border bg-background mt-1 min-h-9 rounded-md border p-2.5">
            {draft.prompt.trim() ? (
              <Tex className="text-foreground text-sm">{draft.prompt}</Tex>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        </div>

        <div>
          <Label>Variantlar (düzgün cavabı seçin)</Label>
          <div className="mt-1.5 space-y-2">
            {draft.choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  aria-label={`Düzgün cavab ${String.fromCharCode(65 + i)}`}
                  checked={draft.correctIndex === i}
                  onChange={() => setDraft({ ...draft, correctIndex: i })}
                  className="size-4 shrink-0"
                />
                <span className="text-muted-foreground w-4 shrink-0 text-sm font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <Input
                  value={c}
                  onChange={(e) => setChoice(i, e.target.value)}
                  placeholder={`$…$`}
                  className="font-mono text-sm"
                />
                <button
                  type="button"
                  aria-label="Variantı sil"
                  onClick={() => removeChoice(i)}
                  disabled={draft.choices.length <= 2}
                  className="text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-30"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          {draft.choices.length < 8 && (
            <button
              type="button"
              onClick={addChoice}
              className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-semibold"
            >
              <Plus className="size-3.5" /> Variant əlavə et
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <LatexImageField
          id="q-explanation"
          label="Həll / izah (istəyə bağlı)"
          value={draft.explanation}
          onChange={(v) => setDraft({ ...draft, explanation: v })}
          rows={2}
          placeholder="Nəticədən sonra tələbəyə göstərilir. LaTeX dəstəklənir."
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Ləğv et
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Check />} Yadda saxla
        </Button>
      </div>
    </div>
  );
}
