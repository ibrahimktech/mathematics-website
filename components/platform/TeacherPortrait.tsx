import Image from "next/image";
import { GraduationCap } from "lucide-react";
import { TEACHER } from "@/lib/platform";
import { cn } from "@/lib/utils";

/**
 * The teacher's portrait — a first-class brand element (hero + teacher section).
 *
 * When `TEACHER.photo` (in `lib/platform.ts`) is empty, a tasteful, clearly
 * intentional placeholder is shown instead of a fabricated face. Drop the real
 * photo into `/public` and set `TEACHER.photo = "/teacher.jpg"` to replace it.
 */
export function TeacherPortrait({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card relative aspect-[4/5] overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      {TEACHER.photo ? (
        <Image
          src={TEACHER.photo}
          alt={`${TEACHER.name} — ${TEACHER.title}`}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 460px"
          className="object-cover"
        />
      ) : (
        <div className="bg-surface-soft absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <div className="border-primary/20 bg-card/70 text-primary/60 mx-auto grid size-20 place-items-center rounded-2xl border">
              <GraduationCap className="size-9" />
            </div>
            <p className="text-foreground/70 mt-5 text-sm font-medium">
              Müəllimin fotosu
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed">
              Real şəkil əlavə olunduqda burada görünəcək.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
