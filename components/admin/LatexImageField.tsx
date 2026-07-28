"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadExamImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * A LaTeX textarea that can also hold images. Images are NOT a separate column:
 * the uploaded file's public URL is written into the same LaTeX string as
 * `\includegraphics{…}`, which `lib/latex/render.ts` already renders (with URL
 * sanitisation) everywhere a question is shown — admin preview, exam runner and
 * results page. So nothing about the question format changes, and questions
 * written before this feature are untouched.
 *
 * Upload goes through `uploadExamImage` → the same `article-images` bucket as
 * the blog editor, whose storage RLS allows writes only to `public.admins`.
 */

/** Matches `\includegraphics[opts]{url}` exactly as the renderer parses it. */
function findImages(value: string): { url: string; start: number; end: number }[] {
  const re = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g;
  const out: { url: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    out.push({ url: m[1].trim(), start: m.index, end: re.lastIndex });
  }
  return out;
}

/** Drop one `\includegraphics{…}` plus only the whitespace it introduced. */
function removeImageAt(value: string, start: number, end: number): string {
  let to = end;
  while (to < value.length && (value[to] === " " || value[to] === "\t")) to++;
  if (value[to] === "\n" && (start === 0 || value[start - 1] === "\n")) to++;
  return value.slice(0, start) + value.slice(to);
}

export function LatexImageField({
  id,
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Put the caret back after an insertion so the admin keeps typing in place.
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  /** Insert the uploaded images at the caret, each on its own line. */
  function insertAtCaret(urls: string[]) {
    const ta = ref.current;
    const at = ta ? ta.selectionStart : value.length;
    const before = value.slice(0, at);
    const after = value.slice(at);
    const body = urls.map((u) => `\\includegraphics{${u}}`).join("\n");
    const lead = !before || before.endsWith("\n") ? "" : "\n";
    const tail = !after || after.startsWith("\n") ? "" : "\n";
    const text = `${lead}${body}${tail}`;
    caret.current = at + text.length;
    onChange(before + text + after);
  }

  async function handleFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setUploading(true);
    const toastId = toast.loading(
      imgs.length > 1 ? "Şəkillər yüklənir…" : "Şəkil yüklənir…",
    );
    try {
      const urls: string[] = [];
      for (const f of imgs) urls.push(await uploadExamImage(f));
      insertAtCaret(urls);
      toast.success("Şəkil əlavə olundu", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükləmə alınmadı", {
        id: toastId,
      });
    } finally {
      setUploading(false);
    }
  }

  const images = findImages(value);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-semibold disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ImageIcon className="size-3.5" />
          )}
          {uploading ? "Yüklənir…" : "Şəkil əlavə et"}
        </button>
      </div>

      <div
        className={cn(
          "mt-1.5 rounded-lg",
          dragging && "ring-primary ring-2",
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
        <Textarea
          id={id}
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
          rows={rows}
          placeholder={placeholder}
          className="font-mono text-sm"
        />
      </div>

      {images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <li
              key={`${img.start}-${i}`}
              className="border-border bg-background relative rounded-md border p-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Şəkil ${i + 1}`}
                className="h-16 w-24 rounded object-contain"
              />
              <button
                type="button"
                aria-label={`Şəkli sil ${i + 1}`}
                onClick={() =>
                  onChange(removeImageAt(value, img.start, img.end))
                }
                className="bg-background text-muted-foreground hover:text-destructive absolute -top-2 -right-2 rounded-full border p-0.5 shadow-sm"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>}

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
