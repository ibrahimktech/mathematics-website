"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add(raw: string) {
    const t = raw.trim().replace(/,$/, "").trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  }
  function remove(t: string) {
    onChange(value.filter((x) => x !== t));
  }

  return (
    <div className="border-input bg-background focus-within:border-ring focus-within:ring-ring/40 flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-[3px]">
      {value.map((t) => (
        <span
          key={t}
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm"
        >
          {t}
          <button
            type="button"
            onClick={() => remove(t)}
            aria-label={`${t} teqini sil`}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(input);
          } else if (e.key === "Backspace" && !input && value.length) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => input.trim() && add(input)}
        placeholder={value.length ? "" : "Teq əlavə et, Enter ilə təsdiqlə"}
        className="text-foreground placeholder:text-muted-foreground/70 min-w-[10rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
    </div>
  );
}
