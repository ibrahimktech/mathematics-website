import { memo } from "react";
import { renderLatexToHtml } from "@/lib/latex/render";
import { cn } from "@/lib/utils";

/**
 * Renders LaTeX source to typeset HTML. Shared component (no "use client"):
 * runs server-side on published article pages and is reused in the editor's
 * live preview, so the preview matches the published output exactly.
 *
 * Memoised for the same reason as `Tex`: React 19 compares
 * `dangerouslySetInnerHTML` by reference, so an unmemoised render rewrites
 * `innerHTML` — throwing away the scroll position of every wide equation — even
 * when the LaTeX has not changed. In the editor that happens on any unrelated
 * state change (a keystroke in the title, a tab switch); on the server it is a
 * no-op wrapper.
 */
export const LatexContent = memo(function LatexContent({
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
});
