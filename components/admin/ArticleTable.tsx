"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Undo2, Trash2, Pencil, Loader2 } from "lucide-react";
import { setPostStatus, deletePost } from "@/lib/actions/posts";
import { formatDateShort } from "@/lib/format";
import type { PostWithCategory } from "@/lib/types";

export function ArticleTable({
  posts,
  empty = "Hələ məqalə yoxdur.",
}: {
  posts: PostWithCategory[];
  empty?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(p: PostWithCategory) {
    setBusyId(p.id);
    const res = await setPostStatus(
      p.id,
      p.status === "published" ? "draft" : "published",
    );
    setBusyId(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      p.status === "published" ? "Qaralamaya köçürüldü" : "Dərc edildi",
    );
    router.refresh();
  }

  async function remove(p: PostWithCategory) {
    if (!window.confirm(`"${p.title}" silinsin?`)) return;
    setBusyId(p.id);
    const res = await deletePost(p.id);
    setBusyId(null);
    if (!res.ok) return toast.error(res.error);
    toast.success("Məqalə silindi");
    router.refresh();
  }

  if (!posts.length) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        {empty}
      </div>
    );
  }

  return (
    <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {posts.map((p) => {
        const busy = busyId === p.id;
        return (
          <div
            key={p.id}
            className="hover:bg-muted/40 flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/articles/${p.id}/edit`}
                className="hover:text-primary font-medium"
              >
                {p.title || "(Başlıqsız)"}
              </Link>
              <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span
                  className={
                    "rounded-full px-2 py-0.5 font-medium " +
                    (p.status === "published"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground")
                  }
                >
                  {p.status === "published" ? "Dərc edilib" : "Qaralama"}
                </span>
                {p.category && (
                  <span>
                    {p.category.emoji ? `${p.category.emoji} ` : ""}
                    {p.category.name}
                  </span>
                )}
                <span>· {formatDateShort(p.updated_at)}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/admin/articles/${p.id}/edit`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm"
              >
                <Pencil className="size-3.5" /> Redaktə
              </Link>
              <button
                type="button"
                onClick={() => toggle(p)}
                disabled={busy}
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : p.status === "published" ? (
                  <Undo2 className="size-3.5" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {p.status === "published" ? "Dərcdən çıxar" : "Dərc et"}
              </button>
              <button
                type="button"
                onClick={() => remove(p)}
                disabled={busy}
                aria-label="Sil"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
