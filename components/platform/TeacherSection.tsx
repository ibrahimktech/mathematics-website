import { TEACHER } from "@/lib/platform";
import { TeacherPortrait } from "./TeacherPortrait";

/** Introduces the real person behind the platform (placeholder bio for now). */
export function TeacherSection() {
  return (
    <section className="border-border bg-card border-y">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <TeacherPortrait className="mx-auto w-full max-w-xs" />
          </div>

          <div className="lg:col-span-8">
            <span className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Müəllim
            </span>
            <h2 className="font-display text-foreground mt-2.5 text-3xl font-bold tracking-tight sm:text-[2.1rem]">
              {TEACHER.name}
            </h2>
            <p className="text-primary mt-1 font-medium">{TEACHER.title}</p>

            <div className="text-foreground/90 mt-5 space-y-4 leading-relaxed">
              {TEACHER.bio.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
