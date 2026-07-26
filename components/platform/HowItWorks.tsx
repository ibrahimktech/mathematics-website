import { PLATFORM } from "@/lib/platform";
import { SectionHeading } from "./SectionHeading";

/** Three-step explanation. Typography-led — no oversized illustrated cards. */
export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <SectionHeading eyebrow="Necə işləyir" title="Üç sadə addım" />

      <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {PLATFORM.steps.map((step) => (
          <div key={step.n}>
            <span
              aria-hidden
              className="font-display text-primary/25 text-5xl font-bold tabular-nums"
            >
              {step.n}
            </span>
            <h3 className="font-display text-foreground mt-3 text-lg font-bold tracking-tight">
              {step.title}
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {step.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
