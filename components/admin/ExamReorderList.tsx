"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Loader2, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { reorderExams } from "@/lib/actions/exams";
import {
  difficultyLabel,
  examPublishChipClass,
  examPublishLabel,
  formatPrice,
} from "@/lib/exams/display";
import type { ExamRow } from "@/lib/exams/types";
import { cn } from "@/lib/utils";

/**
 * Drag the exams into the order students should see them in.
 *
 * The list is the teacher's working copy: dragging only moves rows locally and
 * NOTHING is written until "Yadda saxla", which sends the whole order in one
 * atomic call (`reorderExams` → the `reorder_exams` RPC). If that call fails the
 * dragged order stays on screen so the work isn't lost and can be retried — the
 * database still holds the previous order, untouched.
 *
 * Every exam is listed, drafts and archived ones included: they hold positions
 * too, so publishing a draft leaves it exactly where it was put.
 */

/** The list is a single column — horizontal drift while dragging is just noise. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function SortableExamRow({
  exam,
  position,
  disabled,
}: {
  exam: ExamRow;
  position: number;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exam.id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{
        // Translate, not Transform: a scale component would squash the rows.
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        "border-border bg-card flex items-center gap-3 rounded-xl border p-3 sm:gap-4 sm:p-4",
        isDragging && "ring-primary/30 relative z-10 shadow-lg ring-2",
      )}
    >
      <button
        type="button"
        // `touch-none` hands the gesture to dnd-kit instead of the scroller,
        // which is what makes dragging work on a touchscreen at all.
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 -m-1 shrink-0 cursor-grab touch-none rounded-md p-1 outline-none focus-visible:ring-3 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
        aria-label={`${exam.title} — sıranı dəyiş`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>

      <span className="text-muted-foreground w-6 shrink-0 text-sm font-bold tabular-nums">
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <p className="exam-title text-foreground truncate font-semibold">
          {exam.title}
        </p>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span>{difficultyLabel(exam.difficulty)}</span>
          <span>{formatPrice(Number(exam.price), exam.currency)}</span>
        </div>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
          examPublishChipClass(exam.status),
        )}
      >
        {examPublishLabel(exam.status)}
      </span>
    </li>
  );
}

export function ExamReorderList({ exams }: { exams: ExamRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(exams);
  const [saving, setSaving] = useState(false);

  const savedOrder = exams.map((e) => e.id).join(",");
  const dirty = items.map((e) => e.id).join(",") !== savedOrder;

  const sensors = useSensors(
    // A few pixels of travel before a drag begins, so the handle still accepts
    // ordinary clicks and keyboard focus without the list twitching.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const from = current.findIndex((e) => e.id === active.id);
      const to = current.findIndex((e) => e.id === over.id);
      if (from === -1 || to === -1) return current;
      return arrayMove(current, from, to);
    });
  }

  async function save() {
    setSaving(true);
    const res = await reorderExams(items.map((e) => e.id));
    setSaving(false);

    if (!res.ok) {
      // Nothing was written, so keep the dragged order visible to retry from.
      toast.error(res.error);
      return;
    }
    toast.success("Sıralama yadda saxlanıldı");
    router.push("/admin/exams");
    router.refresh();
  }

  if (exams.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-16 text-center text-sm">
        Sıralanacaq imtahan yoxdur.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setItems(exams)}
          disabled={!dirty || saving}
        >
          <Undo2 /> Geri qaytar
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Yadda saxla
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="mt-4 space-y-2">
            {items.map((exam, i) => (
              <SortableExamRow
                key={exam.id}
                exam={exam}
                position={i + 1}
                disabled={saving}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
