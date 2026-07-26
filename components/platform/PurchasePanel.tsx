"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  Check,
  Upload,
  FileText,
  CircleCheck,
  Info,
} from "lucide-react";
import { submitPurchase } from "@/lib/student/actions";
import { formatPrice } from "@/lib/exams/display";
import type { PlatformSettings } from "@/lib/settings";

const MAX_MB = 5;
const ACCEPT = "image/jpeg,image/png,application/pdf";

/**
 * The manual bank-transfer payment step. Shows the teacher's bank details, lets
 * the student upload a receipt (JPG/PNG/PDF) OR tick "I can't upload a receipt",
 * then submits a PENDING purchase via `submitPurchase`. The receipt is validated
 * again server-side (size + magic bytes); this client check is only for UX.
 * Duplicate submits are blocked here (disabled while sending) and in the DB.
 */
export function PurchasePanel({
  examId,
  amount,
  currency,
  settings,
  deniedNote,
}: {
  examId: string;
  amount: number;
  currency: string;
  settings: PlatformSettings;
  deniedNote?: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const submittedRef = useRef(false);

  function pickFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Fayl ${MAX_MB} MB-dan böyük ola bilməz.`);
      return;
    }
    const okType =
      f.type === "image/jpeg" ||
      f.type === "image/png" ||
      f.type === "application/pdf";
    if (!okType) {
      toast.error("Yalnız JPG, PNG və ya PDF qəbul olunur.");
      return;
    }
    setFile(f);
    setUnavailable(false);
  }

  async function copyCard() {
    if (!settings.card_number) return;
    try {
      await navigator.clipboard.writeText(settings.card_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  async function submit() {
    if (submittedRef.current) return;
    if (!unavailable && !file) {
      toast.error("Qəbz yükləyin və ya “qəbz yükləyə bilmirəm” seçin.");
      return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("examId", examId);
    fd.set("receiptUnavailable", String(unavailable));
    if (file && !unavailable) fd.set("receipt", file);
    const res = await submitPurchase(fd);
    if (!res.ok) {
      submittedRef.current = false;
      setSubmitting(false);
      toast.error(res.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border-border bg-card rounded-2xl border p-6 text-center sm:p-8">
        <div className="bg-emerald-50 text-emerald-600 mx-auto grid size-14 place-items-center rounded-full">
          <CircleCheck className="size-7" />
        </div>
        <h2 className="exam-title text-foreground mt-4 text-xl font-bold">
          Ödəniş sorğusu göndərildi
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
          Ödənişiniz hazırda yoxlanılır. Təsdiqləndikdən sonra imtahan avtomatik
          olaraq panelinizdə görünəcək. Hələ imtahana giriş açılmayıb.
        </p>
        <Link
          href="/panel/imtahanlar"
          className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          İmtahanlarıma keç
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {deniedNote !== undefined && deniedNote !== null && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
          Əvvəlki sorğunuz rədd edildi{deniedNote ? `: ${deniedNote}` : "."}. Yenidən
          cəhd edə bilərsiniz.
        </div>
      )}

      {/* Bank details */}
      <div className="border-border bg-card rounded-2xl border p-6">
        <h2 className="exam-title text-foreground text-lg font-bold">
          Ödəniş məlumatları
        </h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Ödəniləcək məbləğ</span>
            <span className="text-foreground text-lg font-bold">
              {formatPrice(amount, currency)}
            </span>
          </div>
          {settings.bank_name && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Bank</span>
              <span className="text-foreground font-medium">{settings.bank_name}</span>
            </div>
          )}
          {settings.account_holder && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Hesab sahibi</span>
              <span className="text-foreground font-medium">
                {settings.account_holder}
              </span>
            </div>
          )}
          {settings.card_number ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Kart / hesab</span>
              <button
                type="button"
                onClick={copyCard}
                className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 font-mono text-sm font-medium"
              >
                {settings.card_number}
                {copied ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="text-muted-foreground size-3.5" />
                )}
              </button>
            </div>
          ) : (
            <div className="border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-2 rounded-lg border p-3 text-xs">
              <Info className="mt-0.5 size-4 shrink-0" />
              Ödəniş rekvizitləri hələ əlavə edilməyib. Müəllimlə əlaqə saxlayın.
            </div>
          )}
        </div>

        <p className="text-muted-foreground mt-4 border-t border-dashed pt-4 text-sm leading-relaxed whitespace-pre-line">
          {settings.instructions ||
            "Yuxarıdakı hesaba köçürmə edin, sonra qəbzi aşağıda yükləyin. Ödəniş əl ilə yoxlanılır və təsdiqdən sonra imtahan panelinizdə açılır."}
        </p>
      </div>

      {/* Receipt upload */}
      <div className="border-border bg-card rounded-2xl border p-6">
        <h2 className="exam-title text-foreground text-lg font-bold">
          Ödəniş qəbzi
        </h2>

        {file ? (
          <div className="border-border mt-4 flex items-center justify-between gap-3 rounded-xl border p-3">
            <span className="text-foreground flex min-w-0 items-center gap-2 text-sm">
              <FileText className="text-primary size-4 shrink-0" />
              <span className="truncate">{file.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-muted-foreground hover:text-destructive shrink-0 text-sm font-medium"
            >
              Sil
            </button>
          </div>
        ) : (
          <label
            className={
              "border-input mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed py-8 text-sm transition-colors " +
              (unavailable ? "pointer-events-none opacity-50" : "hover:bg-muted")
            }
          >
            <Upload className="text-muted-foreground mb-2 size-6" />
            <span className="text-foreground font-medium">Qəbz seçin</span>
            <span className="text-muted-foreground mt-0.5 text-xs">
              JPG, PNG və ya PDF · maks. {MAX_MB} MB
            </span>
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={unavailable}
              onChange={(e) => {
                pickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        )}

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={unavailable}
            onChange={(e) => {
              setUnavailable(e.target.checked);
              if (e.target.checked) setFile(null);
            }}
            className="border-input mt-0.5 size-4 shrink-0 rounded"
          />
          <span className="text-foreground">
            Qəbz yükləyə bilmirəm
            <span className="text-muted-foreground block text-xs">
              Ödənişiniz bank hesabından əl ilə yoxlanılacaq.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Ödədim — sorğunu göndər
        </button>
        <p className="text-muted-foreground mt-3 text-center text-xs">
          Sorğunuz göndəriləcək və müəllim tərəfindən yoxlanılacaq.
        </p>
      </div>
    </div>
  );
}
