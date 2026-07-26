import { renderLatexToHtml } from "@/lib/latex/render";
import { cn } from "@/lib/utils";

/**
 * Renders a short LaTeX fragment (question prompt or answer choice) to HTML with
 * KaTeX for the math. Used inside the exam UI (`.app-ui`), where CSS strips the
 * paragraph margins and forces sans-serif text so only the math is KaTeX.
 */
export function Tex({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn("tex", className)}
      dangerouslySetInnerHTML={{ __html: renderLatexToHtml(children) }}
    />
  );
}
