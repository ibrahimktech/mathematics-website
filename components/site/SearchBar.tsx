"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function SearchBar({
  initialQuery = "",
  autoFocus = false,
  placeholder = "Axtar…",
  onSubmitted,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  placeholder?: string;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/axtar?q=${encodeURIComponent(query)}`);
    onSubmitted?.();
  }

  return (
    <form onSubmit={submit} role="search" className="group relative">
      <Search className="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 transition-colors" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="Axtar"
        className="border-border bg-card text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-primary/20 h-10 w-full rounded-full border pr-4 pl-10 text-sm shadow-sm outline-none transition-all focus-visible:ring-4 focus-visible:shadow-none"
      />
    </form>
  );
}
