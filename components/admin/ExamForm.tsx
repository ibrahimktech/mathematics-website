"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Save,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagsInput } from "@/components/admin/TagsInput";
import { slugify } from "@/lib/slug";
import { DIFFICULTY_OPTIONS } from "@/lib/exams/display";
import { saveExam, setExamStatus, deleteExam } from "@/lib/actions/exams";
import type { ExamRow } from "@/lib/exams/types";
import type { Category } from "@/lib/types";

export function ExamForm({
  initial,
  categories,
}: {
  initial?: ExamRow | null;
  categories: Category[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categorySlug, setCategorySlug] = useState(initial?.category_slug ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "intermediate");
  const [price, setPrice] = useState(String(initial?.price ?? 0));
  const [currency, setCurrency] = useState(initial?.currency ?? "AZN");
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? 30));
  const [covers, setCovers] = useState<string[]>(initial?.covers ?? []);
  const [featured, setFeatured] = useState(Boolean(initial?.featured));
  const [status, setStatus] = useState(initial?.status ?? "draft");

  const [saving, setSaving] = useState<null | "draft" | "published">(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(title));
  }, [title, slugEdited]);

  async function submit(target: "draft" | "published") {
    if (!title.trim()) {
      toast.error("Ad tələb olunur");
      return;
    }
    setSaving(target);
    const res = await saveExam({
      id: initial?.id,
      title,
      slug,
      summary,
      description,
      category_slug: categorySlug || null,
      difficulty: difficulty as ExamRow["difficulty"],
      price: Number(price) || 0,
      currency,
      duration_minutes: Number(duration) || 0,
      covers,
      featured,
      status: target,
    });
    setSaving(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStatus(target);
    toast.success(
      target === "published" ? "İmtahan dərc edildi" : "Qaralama yadda saxlanıldı",
    );
    if (!initial?.id && res.id) {
      router.replace(`/admin/exams/${res.id}/edit`);
    } else {
      router.refresh();
    }
  }

  async function unpublish() {
    if (!initial?.id) return;
    setSaving("draft");
    const res = await setExamStatus(initial.id, "draft");
    setSaving(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStatus("draft");
    toast.success("İmtahan qaralamaya köçürüldü");
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm("Bu imtahanı və bütün suallarını silmək istədiyinizə əminsiniz?"))
      return;
    setDeleting(true);
    const res = await deleteExam(initial.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("İmtahan silindi");
    router.push("/admin/exams");
  }

  const busy = saving !== null || deleting;

  return (
    <div>
      {/* Action bar */}
      <div className="bg-background/95 sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link
          href="/admin/exams"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> İmtahanlar
        </Link>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-xs font-medium " +
            (status === "published"
              ? "bg-primary/10 text-primary"
              : status === "archived"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground")
          }
        >
          {status === "published"
            ? "Dərc edilib"
            : status === "archived"
              ? "Arxivlənib"
              : "Qaralama"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {initial?.status === "published" && (
            <a
              href={`/imtahanlar/${initial.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink /> Bax
            </a>
          )}
          {initial?.id && (
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={busy}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Sil
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => submit("draft")} disabled={busy}>
            {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />}
            Yadda saxla
          </Button>
          {status === "published" ? (
            <Button variant="secondary" size="sm" onClick={unpublish} disabled={busy}>
              <Undo2 /> Dərcdən çıxar
            </Button>
          ) : (
            <Button size="sm" onClick={() => submit("published")} disabled={busy}>
              {saving === "published" ? <Loader2 className="animate-spin" /> : <Send />}
              Dərc et
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="İmtahanın adı"
            aria-label="Ad"
            className="exam-title placeholder:text-muted-foreground/50 w-full bg-transparent text-3xl font-bold tracking-tight outline-none"
          />

          <div>
            <Label htmlFor="summary">Qısa təsvir (kartlarda görünür)</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="Bir cümləlik təsvir."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">Ətraflı təsvir</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="İmtahanın məzmunu, kimlər üçün uyğun olduğu və s."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Əhatə olunan mövzular</Label>
            <div className="mt-1.5">
              <TagsInput value={covers} onChange={setCovers} />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              İmtahan səhifəsində siyahı kimi göstərilir.
            </p>
          </div>
        </div>

        {/* Settings sidebar */}
        <aside className="order-1 space-y-5 lg:order-2">
          <div>
            <Label htmlFor="slug">Bağlantı (slug)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              className="mt-1.5 font-mono text-sm"
            />
            <p className="text-muted-foreground mt-1 truncate text-xs">
              /imtahanlar/{slug || "…"}
            </p>
          </div>

          <div>
            <Label htmlFor="category">Kateqoriya</Label>
            <select
              id="category"
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
            >
              <option value="">Kateqoriyasız</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground mt-1 text-xs">
              Bloq kateqoriyası ilə eyni — imtahan ↔ məqalə əlaqəsi üçün.
            </p>
          </div>

          <div>
            <Label htmlFor="difficulty">Çətinlik</Label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as ExamRow["difficulty"])}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
            >
              {DIFFICULTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price">Qiymət</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="currency">Valyuta</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <p className="text-muted-foreground -mt-3 text-xs">
            Qiymət 0 = pulsuz (girişə ehtiyac yoxdur).
          </p>

          <div>
            <Label htmlFor="duration">Müddət (dəqiqə)</Label>
            <Input
              id="duration"
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="border-input size-4 rounded"
            />
            Ana səhifədə seçilmiş kimi göstər
          </label>
        </aside>
      </div>
    </div>
  );
}
