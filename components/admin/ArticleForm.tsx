"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Loader2,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Editor } from "@/components/admin/Editor";
import { TagsInput } from "@/components/admin/TagsInput";
import { slugify } from "@/lib/slug";
import { uploadArticleImage, validateImage } from "@/lib/upload";
import { savePost, deletePost, setPostStatus } from "@/lib/actions/posts";
import type { Category, PostWithCategory } from "@/lib/types";

export function ArticleForm({
  initial,
  categories,
}: {
  initial?: PostWithCategory | null;
  categories: Category[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [content, setContent] = useState(initial?.content ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.cover_image_url ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status ?? "draft",
  );

  const [saving, setSaving] = useState<null | "draft" | "published">(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(title));
  }, [title, slugEdited]);

  async function submit(target: "draft" | "published") {
    if (!title.trim()) {
      toast.error("Başlıq tələb olunur");
      return;
    }
    setSaving(target);
    const res = await savePost({
      id: initial?.id,
      title,
      slug,
      excerpt,
      content,
      cover_image_url: coverUrl,
      category_id: categoryId,
      tags,
      status: target,
    });
    setSaving(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStatus(target);
    toast.success(
      target === "published" ? "Məqalə dərc edildi" : "Qaralama yadda saxlanıldı",
    );
    if (!initial?.id && res.id) {
      router.replace(`/admin/articles/${res.id}/edit`);
    } else {
      router.refresh();
    }
  }

  async function unpublish() {
    if (!initial?.id) return;
    setSaving("draft");
    const res = await setPostStatus(initial.id, "draft");
    setSaving(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStatus("draft");
    toast.success("Məqalə qaralamaya köçürüldü");
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm("Bu məqaləni silmək istədiyinizə əminsiniz?")) return;
    setDeleting(true);
    const res = await deletePost(initial.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Məqalə silindi");
    router.push("/admin/articles");
  }

  async function onCoverFile(file: File) {
    const err = validateImage(file);
    if (err) {
      toast.error(err);
      return;
    }
    setUploadingCover(true);
    try {
      const url = await uploadArticleImage(file);
      setCoverUrl(url);
      toast.success("Örtük şəkli yükləndi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükləmə alınmadı");
    } finally {
      setUploadingCover(false);
    }
  }

  const busy = saving !== null || deleting;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Action bar */}
      <div className="bg-background/95 sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link
          href="/admin/articles"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Məqalələr
        </Link>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-xs font-medium " +
            (status === "published"
              ? "bg-primary/10 text-primary"
              : "bg-secondary text-muted-foreground")
          }
        >
          {status === "published" ? "Dərc edilib" : "Qaralama"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {initial?.status === "published" && (
            <a
              href={`/meqale/${initial.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink /> Bax
            </a>
          )}
          {initial?.id && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={busy}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Sil
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit("draft")}
            disabled={busy}
          >
            {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />}
            Yadda saxla
          </Button>
          {status === "published" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={unpublish}
              disabled={busy}
            >
              <Undo2 /> Dərcdən çıxar
            </Button>
          ) : (
            <Button size="sm" onClick={() => submit("published")} disabled={busy}>
              {saving === "published" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Send />
              )}
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
            placeholder="Başlıq"
            aria-label="Başlıq"
            className="font-heading placeholder:text-muted-foreground/50 w-full bg-transparent text-3xl font-bold tracking-tight outline-none"
          />
          <Editor value={content} onChange={setContent} />
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
              /meqale/{slug || "…"}
            </p>
          </div>

          <div>
            <Label htmlFor="category">Kateqoriya</Label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
            >
              <option value="">Kateqoriyasız</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="excerpt">Qısa təsvir</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="Siyahılarda və axtarış nəticələrində görünən qısa mətn."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Örtük şəkli</Label>
            {coverUrl ? (
              <div className="relative mt-1.5 overflow-hidden rounded-md border">
                <Image
                  src={coverUrl}
                  alt="Örtük"
                  width={320}
                  height={180}
                  className="h-36 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  aria-label="Örtük şəklini sil"
                  className="bg-background/90 hover:bg-background absolute top-2 right-2 rounded-md border p-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="border-input hover:bg-muted mt-1.5 flex h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-sm transition-colors">
                {uploadingCover ? (
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="text-muted-foreground mb-1 size-5" />
                    <span className="text-muted-foreground">Şəkil seç</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void onCoverFile(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <div>
            <Label>Teqlər</Label>
            <div className="mt-1.5">
              <TagsInput value={tags} onChange={setTags} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
