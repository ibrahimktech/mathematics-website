"use client";

import { useDeferredValue, useLayoutEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Image as ImageIcon,
  Table as TableIcon,
  Eye,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LatexContent } from "@/components/site/LatexContent";
import { uploadArticleImage } from "@/lib/upload";

type Sel = { start: number; end: number };

// Placeholder marking where the caret should land inside an inserted snippet.
const CURSOR = "";

export function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<Sel | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [dragging, setDragging] = useState(false);

  const deferred = useDeferredValue(value);

  useLayoutEffect(() => {
    if (pending.current && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(pending.current.start, pending.current.end);
      pending.current = null;
    }
  }, [value]);

  function currentSel(): Sel {
    const ta = ref.current;
    if (!ta) return { start: value.length, end: value.length };
    return { start: ta.selectionStart, end: ta.selectionEnd };
  }

  function commit(next: string, start: number, end: number) {
    pending.current = { start, end };
    onChange(next);
  }

  /** Insert a snippet; CURSOR marks caret position and wraps any selection. */
  function snippet(tpl: string) {
    const v = valueRef.current;
    const s = currentSel();
    const selected = v.slice(s.start, s.end);
    const idx = tpl.indexOf(CURSOR);
    const clean = tpl.replace(CURSOR, "");
    const cursorPos = idx < 0 ? clean.length : idx;
    const inserted =
      cursorPos >= 0
        ? clean.slice(0, cursorPos) + selected + clean.slice(cursorPos)
        : clean;
    const next = v.slice(0, s.start) + inserted + v.slice(s.end);
    const caret = s.start + cursorPos;
    commit(next, caret, caret + selected.length);
  }

  function insertRaw(text: string) {
    const v = valueRef.current;
    const s = currentSel();
    const next = v.slice(0, s.start) + text + v.slice(s.end);
    const caret = s.start + text.length;
    commit(next, caret, caret);
  }

  async function handleFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const id = toast.loading(
      imgs.length > 1 ? "Şəkillər yüklənir…" : "Şəkil yüklənir…",
    );
    try {
      const blocks: string[] = [];
      for (const f of imgs) {
        const url = await uploadArticleImage(f);
        blocks.push(
          `\\begin{figure}\n\\centering\n\\includegraphics{${url}}\n\\caption{}\n\\end{figure}`,
        );
      }
      insertRaw(`\n\n${blocks.join("\n\n")}\n\n`);
      toast.success("Şəkil əlavə olundu", { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükləmə alınmadı", { id });
    }
  }

  type Tool =
    | { type: "sep" }
    | {
        type: "btn";
        title: string;
        icon?: React.ReactNode;
        text?: string;
        run: () => void;
      };

  const tools: Tool[] = [
    { type: "btn", title: "Bölmə  \\section", icon: <Heading1 />, run: () => snippet(`\\section{${CURSOR}}`) },
    { type: "btn", title: "Alt bölmə  \\subsection", icon: <Heading2 />, run: () => snippet(`\\subsection{${CURSOR}}`) },
    { type: "sep" },
    { type: "btn", title: "Qalın  \\textbf", icon: <Bold />, run: () => snippet(`\\textbf{${CURSOR}}`) },
    { type: "btn", title: "Kursiv  \\emph", icon: <Italic />, run: () => snippet(`\\emph{${CURSOR}}`) },
    { type: "sep" },
    { type: "btn", title: "Sətiriçi düstur  $…$", text: "$x$", run: () => snippet(`$${CURSOR}$`) },
    { type: "btn", title: "Nömrəli düstur  \\begin{equation}", text: "(1)", run: () => snippet(`\n\\begin{equation}\n${CURSOR}\n\\end{equation}\n`) },
    { type: "btn", title: "Blok düstur  \\[ \\]", text: "$$", run: () => snippet(`\n\\[\n${CURSOR}\n\\]\n`) },
    { type: "btn", title: "Düzləndirilmiş  \\begin{align}", text: "align", run: () => snippet(`\n\\begin{align}\n${CURSOR}\n\\end{align}\n`) },
    { type: "sep" },
    { type: "btn", title: "Teorem  \\begin{theorem}", text: "Teorem", run: () => snippet(`\n\\begin{theorem}\n${CURSOR}\n\\end{theorem}\n`) },
    { type: "btn", title: "İsbat  \\begin{proof}", text: "İsbat", run: () => snippet(`\n\\begin{proof}\n${CURSOR}\n\\end{proof}\n`) },
    { type: "sep" },
    { type: "btn", title: "Nişanlı siyahı  \\begin{itemize}", icon: <List />, run: () => snippet(`\n\\begin{itemize}\n  \\item ${CURSOR}\n  \\item \n\\end{itemize}\n`) },
    { type: "btn", title: "Nömrəli siyahı  \\begin{enumerate}", icon: <ListOrdered />, run: () => snippet(`\n\\begin{enumerate}\n  \\item ${CURSOR}\n  \\item \n\\end{enumerate}\n`) },
    { type: "btn", title: "Cədvəl  \\begin{tabular}", icon: <TableIcon />, run: () => snippet(`\n\\begin{tabular}{ll}\n${CURSOR} & B \\\\\nC & D \\\\\n\\end{tabular}\n`) },
    { type: "sep" },
    { type: "btn", title: "Şəkil yüklə", icon: <ImageIcon />, run: () => fileInputRef.current?.click() },
  ];

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      {/* Toolbar */}
      <div className="border-border flex flex-wrap items-center gap-0.5 border-b p-1.5">
        {tools.map((t, i) =>
          t.type === "sep" ? (
            <span
              key={`sep-${i}`}
              className="bg-border mx-1 hidden h-5 w-px sm:inline-block"
            />
          ) : (
            <button
              key={t.title}
              type="button"
              title={t.title}
              aria-label={t.title}
              onClick={t.run}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm font-medium transition-colors"
            >
              {t.text ? (
                <span className="font-mono text-xs">{t.text}</span>
              ) : (
                <span className="[&_svg]:size-4">{t.icon}</span>
              )}
            </button>
          ),
        )}

        <div className="ml-auto inline-flex gap-0.5 lg:hidden">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm",
              tab === "write"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Pencil className="size-3.5" /> Yaz
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm",
              tab === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Eye className="size-3.5" /> Önizləmə
          </button>
        </div>
      </div>

      {/* Panes */}
      <div className="grid lg:grid-cols-2">
        <div
          className={cn(
            "relative",
            tab === "preview" && "hidden lg:block",
            dragging && "ring-primary ring-2 ring-inset",
          )}
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (e.dataTransfer?.files?.length) {
              e.preventDefault();
              setDragging(false);
              void handleFiles(e.dataTransfer.files);
            }
          }}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (
                files?.length &&
                Array.from(files).some((f) => f.type.startsWith("image/"))
              ) {
                e.preventDefault();
                void handleFiles(files);
              }
            }}
            spellCheck={false}
            placeholder={
              "LaTeX yazın…  Tam sənəd (\\documentclass … \\end{document}) yapışdıra bilərsiniz.\n\nMəsələn:\n\\section{Giriş}\nBir düstur: $a^2+b^2=c^2$\n\\begin{equation}\n  e^{i\\pi}+1=0\n\\end{equation}"
            }
            className="text-foreground placeholder:text-muted-foreground/60 min-h-[65vh] w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
          />
          {dragging && (
            <div className="bg-primary/5 text-primary pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium">
              Şəkli buraya buraxın
            </div>
          )}
        </div>

        <div
          className={cn(
            "border-border bg-background border-t lg:border-t-0 lg:border-l",
            tab === "write" && "hidden lg:block",
          )}
        >
          <div className="min-h-[65vh] overflow-x-auto p-4 sm:p-6">
            {value.trim() ? (
              <LatexContent content={deferred} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Önizləmə burada görünəcək…
              </p>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
