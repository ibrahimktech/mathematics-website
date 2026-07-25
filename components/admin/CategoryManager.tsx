"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCategory, deleteCategory } from "@/lib/actions/categories";
import type { CategoryWithCount } from "@/lib/types";

export function CategoryManager({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    const res = await saveCategory({ name, emoji });
    setAdding(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Kateqoriya əlavə olundu");
    setName("");
    setEmoji("");
    router.refresh();
  }

  function startEdit(c: CategoryWithCount) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditEmoji(c.emoji ?? "");
    setEditSlug(c.slug);
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    const res = await saveCategory({
      id,
      name: editName,
      emoji: editEmoji,
      slug: editSlug,
    });
    setBusyId(null);
    if (!res.ok) return toast.error(res.error);
    toast.success("Yadda saxlanıldı");
    setEditingId(null);
    router.refresh();
  }

  async function remove(c: CategoryWithCount) {
    if (
      !window.confirm(
        `"${c.name}" silinsin? Bu kateqoriyadakı məqalələr silinməyəcək, sadəcə kateqoriyasız qalacaq.`,
      )
    )
      return;
    setBusyId(c.id);
    const res = await deleteCategory(c.id);
    setBusyId(null);
    if (!res.ok) return toast.error(res.error);
    toast.success("Kateqoriya silindi");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <form
        onSubmit={add}
        className="border-border bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <div className="w-16">
          <Label htmlFor="new-emoji">Emoji</Label>
          <Input
            id="new-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="📐"
            className="mt-1.5 text-center"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="new-name">Yeni kateqoriya</Label>
          <Input
            id="new-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kateqoriya adı"
            className="mt-1.5"
          />
        </div>
        <Button type="submit" disabled={adding || !name.trim()}>
          {adding ? <Loader2 className="animate-spin" /> : <Plus />}
          Əlavə et
        </Button>
      </form>

      {/* List */}
      <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {categories.length === 0 && (
          <p className="text-muted-foreground p-6 text-center text-sm">
            Hələ kateqoriya yoxdur.
          </p>
        )}
        {categories.map((c) => {
          const busy = busyId === c.id;
          if (editingId === c.id) {
            return (
              <div key={c.id} className="flex flex-wrap items-end gap-3 p-4">
                <div className="w-16">
                  <Label>Emoji</Label>
                  <Input
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    className="mt-1.5 text-center"
                  />
                </div>
                <div className="min-w-[10rem] flex-1">
                  <Label>Ad</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="min-w-[10rem] flex-1">
                  <Label>Slug</Label>
                  <Input
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    className="mt-1.5 font-mono text-sm"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => saveEdit(c.id)}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    Saxla
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    disabled={busy}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={c.id}
              className="hover:bg-muted/40 flex items-center gap-3 p-4 transition-colors"
            >
              <span className="w-7 text-center text-lg">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-muted-foreground font-mono text-xs">
                  /{c.slug} · {c.post_count} məqalə
                </div>
              </div>
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm"
              >
                <Pencil className="size-3.5" /> Redaktə
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
                disabled={busy}
                aria-label="Sil"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
