import { cn } from "@/lib/utils";

/** Consistent eyebrow + heading + lead used across homepage & platform sections. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <span className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-foreground mt-2.5 text-3xl font-bold tracking-tight text-balance sm:text-[2.1rem]">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground mt-3 leading-relaxed text-pretty">
          {description}
        </p>
      )}
    </div>
  );
}
