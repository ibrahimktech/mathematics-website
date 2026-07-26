"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Loader2, X, ExternalLink } from "lucide-react";
import { fetchReceiptUrl } from "@/lib/actions/settings";

/**
 * Opens a receipt via a SHORT-LIVED SIGNED URL fetched on demand from the server
 * (admin-only; the URL isn't rendered until the admin clicks). Images preview
 * inline; PDFs open in a new tab. There is never a permanent public URL.
 */
export function ReceiptViewer({
  receiptPath,
  receiptUnavailable,
}: {
  receiptPath: string | null;
  receiptUnavailable: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const isPdf = (receiptPath ?? "").toLowerCase().endsWith(".pdf");

  if (receiptUnavailable) {
    return (
      <span className="bg-amber-50 text-amber-700 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        Qəbz yoxdur — bankdan yoxlayın
      </span>
    );
  }
  if (!receiptPath) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  async function view() {
    setLoading(true);
    const signed = await fetchReceiptUrl(receiptPath as string);
    setLoading(false);
    if (!signed) {
      toast.error("Qəbz açılmadı.");
      return;
    }
    if (isPdf) {
      window.open(signed, "_blank", "noopener,noreferrer");
      return;
    }
    setUrl(signed);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={view}
        disabled={loading}
        className="border-border text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : isPdf ? (
          <FileText className="size-3.5" />
        ) : (
          <ImageIcon className="size-3.5" />
        )}
        Qəbzə bax
        {isPdf && <ExternalLink className="size-3" />}
      </button>

      {open && url && !isPdf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card relative max-h-[90vh] max-w-2xl overflow-auto rounded-2xl p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Bağla"
              onClick={() => setOpen(false)}
              className="bg-background/90 hover:bg-background absolute top-4 right-4 rounded-md border p-1.5"
            >
              <X className="size-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Ödəniş qəbzi"
              className="mx-auto max-h-[82vh] w-auto rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}
