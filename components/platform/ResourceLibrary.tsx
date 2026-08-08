"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Download, ExternalLink, Loader2, Search } from "lucide-react";
import { fetchResourceUrl } from "@/lib/actions/resources";
import { formatFileSize, type Resource, type ResourceUrlMode } from "@/lib/resources/types";
import { cn } from "@/lib/utils";

/**
 * The student's PDF shelf.
 *
 * Only METADATA is loaded with the page — no PDF is fetched until "Oxu" or
 * "Yüklə" is pressed, at which point a server action mints a short-lived signed
 * URL for that one resource and the browser talks to Supabase Storage directly
 * (the app server never proxies the file).
 *
 * Search + category filtering run over the already-loaded list: the library is
 * a teacher's shelf, not a catalogue, so a round trip per keystroke would cost
 * more than it saves. All text is rendered as plain text — resource metadata
 * never goes near `dangerouslySetInnerHTML` / the LaTeX renderer.
 */
export function ResourceLibrary({
  resources,
  categoryNames,
}: {
  resources: Resource[];
  /** category slug → display name, resolved server-side from the blog categories. */
  categoryNames: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  /** `${id}:${mode}` while that button's URL is being minted. */
  const [pending, setPending] = useState<string | null>(null);

  const label = useCallback(
    (slug: string) => categoryNames[slug] ?? slug,
    [categoryNames],
  );

  /** Categories actually present in the library, in first-seen order. */
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const r of resources) {
      if (r.category_slug && !seen.includes(r.category_slug)) {
        seen.push(r.category_slug);
      }
    }
    return seen;
  }, [resources]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("az");
    return resources.filter((r) => {
      if (category && r.category_slug !== category) return false;
      if (!q) return true;
      const haystack = [
        r.title,
        r.author,
        r.description,
        r.category_slug ? label(r.category_slug) : null,
      ];
      return haystack.some((v) => v?.toLocaleLowerCase("az").includes(q));
    });
  }, [resources, query, category, label]);

  async function open(resource: Resource, mode: ResourceUrlMode) {
    const key = `${resource.id}:${mode}`;
    if (pending) return;
    setPending(key);
    const res = await fetchResourceUrl(resource.id, mode);
    setPending(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    if (mode === "download") {
      // The signed URL already carries a Content-Disposition filename, so the
      // browser saves it rather than navigating away from the dashboard.
      const a = document.createElement("a");
      a.href = res.url;
      a.download = resource.file_name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    /**
     * The URL only exists after an await, so the `window.open` no longer counts
     * as a direct user gesture and a strict pop-up blocker can swallow it — the
     * student would just see nothing happen. If that occurs, offer the same
     * navigation from a toast button, where the click IS the gesture.
     * (Reverse tabnabbing isn't a concern either way: `Cross-Origin-Opener-Policy:
     * same-origin` in next.config.ts already severs the opener.)
     */
    const opened = window.open(res.url, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.error("Brauzer yeni pəncərəni blokladı.", {
        action: {
          label: "Aç",
          onClick: () => window.open(res.url, "_blank", "noopener,noreferrer"),
        },
      });
    }
  }

  if (resources.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-16 text-center text-sm">
        Hələ resurs yoxdur.
      </div>
    );
  }

  return (
    <div>
      {/* Search + category filter */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Başlıq, müəllif və ya mövzu üzrə axtar"
            aria-label="Resurslarda axtar"
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px]"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={category === ""}
              onClick={() => setCategory("")}
              label="Hamısı"
            />
            {categories.map((slug) => (
              <FilterChip
                key={slug}
                active={category === slug}
                onClick={() => setCategory(slug)}
                label={label(slug)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="border-border text-muted-foreground mt-6 rounded-xl border border-dashed p-12 text-center text-sm">
          Axtarışa uyğun resurs tapılmadı.
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="border-border bg-card flex flex-col rounded-xl border p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-accent text-primary grid size-10 shrink-0 place-items-center rounded-lg"
                >
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0">
                  {/* `.exam-title` is the platform's sans-bold title class (it
                      overrides the base display serif). Reused here so resource
                      cards read exactly like the exam cards they sit beside,
                      rather than adding a second class with identical rules. */}
                  <h2 className="exam-title text-foreground leading-snug font-bold">
                    {r.title}
                  </h2>
                  {r.author && (
                    <p className="text-muted-foreground mt-0.5 truncate text-sm">
                      {r.author}
                    </p>
                  )}
                </div>
              </div>

              {r.category_slug && (
                <span className="bg-secondary text-muted-foreground mt-3 w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {label(r.category_slug)}
                </span>
              )}

              {r.description && (
                <p className="text-muted-foreground mt-3 line-clamp-3 text-sm leading-relaxed">
                  {r.description}
                </p>
              )}

              <div className="mt-auto pt-4">
                <p className="text-muted-foreground text-xs">
                  PDF · {formatFileSize(r.file_size)}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => open(r, "read")}
                    disabled={pending !== null}
                    className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {pending === `${r.id}:read` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                    Oxu
                  </button>
                  <button
                    type="button"
                    onClick={() => open(r, "download")}
                    disabled={pending !== null}
                    className="border-border text-foreground hover:bg-muted inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {pending === `${r.id}:download` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Yüklə
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
