import { memo } from "react";
import { renderLatexToHtml } from "@/lib/latex/render";
import { cn } from "@/lib/utils";

/**
 * Renders a short LaTeX fragment (question prompt or answer choice) to HTML with
 * KaTeX for the math. Used inside the exam UI (`.app-ui`), where CSS strips the
 * paragraph margins and forces sans-serif text so only the math is KaTeX.
 *
 * **`memo` is load-bearing, not a micro-optimisation.** React 19 compares
 * `dangerouslySetInnerHTML` by REFERENCE (`updateProperties` skips a prop only
 * when `next === last`) and never by string value, and this component builds a
 * fresh `{ __html }` object every render — so without the bail-out, ANY parent
 * re-render reassigns `innerHTML` and replaces every child node, even when the
 * markup is byte-for-byte identical. Inside the exam runner that meant a wide
 * formula's `overflow-x` box (`.latex-eq` / `.katex-display`) was rebuilt once a
 * second by the countdown, and its `scrollLeft` snapped back to 0 the instant a
 * student dragged it. Memoised, unchanged LaTeX keeps the very same DOM nodes,
 * so the scroll position survives ticks, autosaves and answer selection; a real
 * content change (moving to the next question) still re-renders and resets it,
 * which is what should happen.
 *
 * Keep the props primitive — anything compared by reference would defeat this.
 */
export const Tex = memo(function Tex({
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
});
