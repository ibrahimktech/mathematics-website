"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createResource,
  deleteResource,
  replaceResourceFile,
  updateResource,
  type ResourceResult,
} from "@/lib/actions/resources";
import { RESOURCE_PDF_MAX_MB, uploadResourcePdf, validateResourcePdf } from "@/lib/upload";
import { formatFileSize, type Resource } from "@/lib/resources/types";
import { formatBakuDate } from "@/lib/format";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Admin CRUD for the PDF library, in the shape of `CategoryManager`: an
 * inline create panel above a list whose rows expand into an edit form.
 *
 * The PDF itself is uploaded straight from this browser to the private
 * `resources` bucket (`uploadResourcePdf`) — a Server Action body is capped at
 * 6 MB, so a book cannot be proxied through the app — and only THEN is the
 * metadata recorded by a server action. Storage RLS (`is_admin()`) is what
 * actually authorises the upload; hiding these controls from a student is
 * cosmetic.
 *
 * Every mutating button disables itself while its request is in flight, and the
 * two-step flows (upload → save) hold a ref so a double-click cannot start a
 * second upload.
 */

type Fields = {
  title: string;
  author: string;
  category_slug: string;
  description: string;
};

const EMPTY_FIELDS: Fields = {
  title: "",
  author: "",
  category_slug: "",
  description: "",
};

function fieldsOf(r: Resource): Fields {
  return {
    title: r.title,
    author: r.author ?? "",
    category_slug: r.category_slug ?? "",
    description: r.description ?? "",
  };
}

/** Report a result honestly: a `warning` means it worked but left a mess. */
function reportResult(res: ResourceResult, successMessage: string): boolean {
  if (!res.ok) {
    toast.error(res.error);
    return false;
  }
  toast.success(successMessage);
  if (res.warning) toast.warning(res.warning);
  return true;
}

/* --------------------------------------------------------------- form parts */

function ResourceFields({
  value,
  onChange,
  categories,
  idPrefix,
  disabled,
}: {
  value: Fields;
  onChange: (next: Fields) => void;
  categories: Category[];
  idPrefix: string;
  disabled?: boolean;
}) {
  const set = <K extends keyof Fields>(key: K, v: Fields[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-title`}>Başlıq</Label>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ədədlər nəzəriyyəsinə giriş"
          maxLength={200}
          disabled={disabled}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-author`}>Müəllif</Label>
        <Input
          id={`${idPrefix}-author`}
          value={value.author}
          onChange={(e) => set("author", e.target.value)}
          placeholder="Müəllifin adı"
          maxLength={200}
          disabled={disabled}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-category`}>Kateqoriya</Label>
        <select
          id={`${idPrefix}-category`}
          value={value.category_slug}
          onChange={(e) => set("category_slug", e.target.value)}
          disabled={disabled}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
        >
          <option value="">Kateqoriyasız</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-description`}>Təsvir</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Bu materialın nə haqqında olduğunu qısaca yazın."
          disabled={disabled}
          className="mt-1.5"
        />
      </div>
    </div>
  );
}

/** File picker + selected-file chip, shared by create and replace. */
function PdfPicker({
  file,
  onPick,
  disabled,
  label,
}: {
  file: File | null;
  onPick: (f: File | null) => void;
  disabled?: boolean;
  label: string;
}) {
  function choose(f: File | null) {
    if (!f) {
      onPick(null);
      return;
    }
    const error = validateResourcePdf(f);
    if (error) {
      toast.error(error);
      return;
    }
    onPick(f);
  }

  return (
    <div>
      <Label>{label}</Label>
      {file ? (
        <div className="border-border mt-1.5 flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="text-foreground flex min-w-0 items-center gap-2 text-sm">
            <FileText className="text-primary size-4 shrink-0" />
            <span className="truncate">{file.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatFileSize(file.size)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onPick(null)}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive shrink-0 text-sm font-medium disabled:opacity-50"
          >
            Sil
          </button>
        </div>
      ) : (
        <label
          className={cn(
            "border-input mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed py-6 text-sm transition-colors",
            disabled ? "pointer-events-none opacity-50" : "hover:bg-muted",
          )}
        >
          <Upload className="text-muted-foreground mb-1.5 size-5" />
          <span className="text-foreground font-medium">PDF seçin</span>
          <span className="text-muted-foreground mt-0.5 text-xs">
            Yalnız PDF · maks. {RESOURCE_PDF_MAX_MB} MB
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              choose(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ manager */

export function ResourceManager({
  resources,
  categories,
}: {
  resources: Resource[];
  categories: Category[];
}) {
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [newFields, setNewFields] = useState<Fields>(EMPTY_FIELDS);
  const [newFile, setNewFile] = useState<File | null>(null);
  /** null = idle; otherwise the stage shown to the admin. */
  const [createStage, setCreateStage] = useState<null | "uploading" | "saving">(null);
  const createLock = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Fields>(EMPTY_FIELDS);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rowLock = useRef(false);

  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  function resetCreate() {
    setNewFields(EMPTY_FIELDS);
    setNewFile(null);
    setCreating(false);
    setCreateStage(null);
  }

  /* ------------------------------------------------------------------ create */
  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (createLock.current) return;
    if (!newFields.title.trim()) {
      toast.error("Başlıq tələb olunur.");
      return;
    }
    if (!newFile) {
      toast.error("PDF faylı seçin.");
      return;
    }

    createLock.current = true;
    const toastId = toast.loading("PDF yüklənir…");
    try {
      setCreateStage("uploading");
      const filePath = await uploadResourcePdf(newFile);

      setCreateStage("saving");
      toast.loading("Yaddaşa yazılır…", { id: toastId });
      const res = await createResource({
        ...newFields,
        file_path: filePath,
        file_name: newFile.name,
      });

      if (!res.ok) {
        // The action already removed the uploaded file, so nothing is orphaned.
        toast.error(res.error, { id: toastId });
        return;
      }
      toast.success("Resurs əlavə olundu", { id: toastId });
      resetCreate();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükləmə alınmadı", {
        id: toastId,
      });
    } finally {
      setCreateStage(null);
      createLock.current = false;
    }
  }

  /* -------------------------------------------------------------------- edit */
  function startEdit(r: Resource) {
    setEditingId(r.id);
    setEditFields(fieldsOf(r));
    setReplaceFor(null);
    setReplaceFile(null);
  }

  async function saveEdit(id: string) {
    if (rowLock.current) return;
    if (!editFields.title.trim()) {
      toast.error("Başlıq tələb olunur.");
      return;
    }
    rowLock.current = true;
    setBusyId(id);
    const res = await updateResource({ id, ...editFields });
    setBusyId(null);
    rowLock.current = false;
    if (!reportResult(res, "Yadda saxlanıldı")) return;
    setEditingId(null);
    router.refresh();
  }

  /* ----------------------------------------------------------------- replace */
  async function submitReplace(id: string) {
    if (rowLock.current) return;
    if (!replaceFile) {
      toast.error("PDF faylı seçin.");
      return;
    }
    rowLock.current = true;
    setBusyId(id);
    const toastId = toast.loading("Yeni PDF yüklənir…");
    try {
      const filePath = await uploadResourcePdf(replaceFile);
      toast.loading("Əvəz olunur…", { id: toastId });
      const res = await replaceResourceFile({
        id,
        file_path: filePath,
        file_name: replaceFile.name,
      });
      if (!res.ok) {
        toast.error(res.error, { id: toastId });
        return;
      }
      toast.success("PDF əvəz olundu", { id: toastId });
      if (res.warning) toast.warning(res.warning);
      setReplaceFor(null);
      setReplaceFile(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükləmə alınmadı", {
        id: toastId,
      });
    } finally {
      setBusyId(null);
      rowLock.current = false;
    }
  }

  /* ------------------------------------------------------------------ delete */
  async function remove(r: Resource) {
    if (rowLock.current) return;
    if (
      !window.confirm(
        `“${r.title}” silinsin? PDF faylı da anbardan həmişəlik silinəcək.`,
      )
    )
      return;
    rowLock.current = true;
    setBusyId(r.id);
    const res = await deleteResource(r.id);
    setBusyId(null);
    rowLock.current = false;
    if (!reportResult(res, "Resurs silindi")) {
      router.refresh(); // a partial failure changed something — re-read the truth
      return;
    }
    router.refresh();
  }

  const creatingBusy = createStage !== null;

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------- create -- */}
      {creating ? (
        <form
          onSubmit={submitCreate}
          className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="exam-title text-base font-bold">Yeni resurs</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Bağla"
              onClick={resetCreate}
              disabled={creatingBusy}
            >
              <X />
            </Button>
          </div>

          <ResourceFields
            value={newFields}
            onChange={setNewFields}
            categories={categories}
            idPrefix="new-resource"
            disabled={creatingBusy}
          />

          <PdfPicker
            label="PDF faylı"
            file={newFile}
            onPick={setNewFile}
            disabled={creatingBusy}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={creatingBusy}>
              {creatingBusy ? <Loader2 className="animate-spin" /> : <Plus />}
              {createStage === "uploading"
                ? "Yüklənir…"
                : createStage === "saving"
                  ? "Yadda saxlanılır…"
                  : "Yüklə və əlavə et"}
            </Button>
            {creatingBusy && (
              <p className="text-muted-foreground text-xs">
                Böyük fayllar bir neçə dəqiqə çəkə bilər — səhifəni bağlamayın.
              </p>
            )}
          </div>
        </form>
      ) : (
        <Button onClick={() => setCreating(true)}>
          <Plus /> Yeni resurs
        </Button>
      )}

      {/* ------------------------------------------------------------- list -- */}
      {resources.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-16 text-center text-sm">
          Hələ resurs yoxdur. İlk PDF-i yükləyin.
        </div>
      ) : (
        <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
          {resources.map((r) => {
            const busy = busyId === r.id;
            const isEditing = editingId === r.id;
            const isReplacing = replaceFor === r.id;

            if (isEditing) {
              return (
                <div key={r.id} className="bg-card space-y-4 p-4 sm:p-5">
                  <ResourceFields
                    value={editFields}
                    onChange={setEditFields}
                    categories={categories}
                    idPrefix={`edit-${r.id}`}
                    disabled={busy}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(r.id)} disabled={busy}>
                      {busy ? <Loader2 className="animate-spin" /> : <Check />}
                      Saxla
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                    >
                      <X /> Ləğv et
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={r.id} className="hover:bg-muted/40 p-4 transition-colors sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span
                      aria-hidden
                      className="bg-accent text-primary mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg"
                    >
                      <BookOpen className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground font-semibold">{r.title}</p>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {r.author && <span>{r.author}</span>}
                        {r.category_slug && (
                          <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                            {categoryName.get(r.category_slug) ?? r.category_slug}
                          </span>
                        )}
                        <span className="font-mono">{r.file_name}</span>
                        <span>{formatFileSize(r.file_size)}</span>
                        <span>{formatBakuDate(r.created_at)}</span>
                      </div>
                      {r.description && (
                        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm">
                          {r.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      disabled={busy}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm disabled:opacity-50"
                    >
                      <Pencil className="size-3.5" /> Redaktə
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceFor(isReplacing ? null : r.id);
                        setReplaceFile(null);
                        setEditingId(null);
                      }}
                      disabled={busy}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm disabled:opacity-50"
                    >
                      <RefreshCw className="size-3.5" /> PDF-i əvəz et
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={busy}
                      aria-label={`${r.title} — sil`}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex size-8 items-center justify-center rounded-md disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isReplacing && (
                  <div className="border-border mt-4 space-y-3 rounded-lg border border-dashed p-3">
                    <PdfPicker
                      label="Yeni PDF"
                      file={replaceFile}
                      onPick={setReplaceFile}
                      disabled={busy}
                    />
                    <p className="text-muted-foreground text-xs">
                      Yeni fayl yükləndikdən sonra köhnəsi silinir — əməliyyat
                      yarımçıq qalsa, mövcud PDF qüvvədə qalır.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => submitReplace(r.id)}
                        disabled={busy || !replaceFile}
                      >
                        {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                        {busy ? "Əvəz olunur…" : "Əvəz et"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplaceFor(null);
                          setReplaceFile(null);
                        }}
                        disabled={busy}
                      >
                        <X /> Ləğv et
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
