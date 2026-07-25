import { renderLatexToHtml } from "@/lib/latex/render";
import { cn } from "@/lib/utils";

/**
 * Renders LaTeX source to typeset HTML. Shared component (no "use client"):
 * runs server-side on published article pages and is reused in the editor's
 * live preview, so the preview matches the published output exactly.
 */
export function LatexContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const html = renderLatexToHtml(content);
  return (
    <div
      className={cn("latex-article", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
