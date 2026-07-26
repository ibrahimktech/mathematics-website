"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAdmin } from "@/lib/admin/auth";
import { getReceiptSignedUrl } from "@/lib/admin/purchases";
import type { ActionResult } from "./types";

/**
 * Admin payment-settings write. Updates the single `platform_settings` row via
 * the cookie client — RLS lets only admins update it — after an `isAdmin()`
 * re-check. These fields are DISPLAY-ONLY payment info; never store secrets here.
 */

const SettingsInput = z.object({
  bank_name: z.string().trim().max(200).optional().nullable(),
  card_number: z.string().trim().max(64).optional().nullable(),
  account_holder: z.string().trim().max(200).optional().nullable(),
  instructions: z.string().trim().max(3000).optional().nullable(),
});
export type SettingsInputData = z.input<typeof SettingsInput>;

export async function saveSettings(
  input: SettingsInputData,
): Promise<ActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };

  const parsed = SettingsInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat." };

  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "İcazə yoxdur." };

  const d = parsed.data;
  try {
    const { error } = await supabase
      .from("platform_settings")
      .update({
        bank_name: d.bank_name?.trim() || null,
        card_number: d.card_number?.trim() || null,
        account_holder: d.account_holder?.trim() || null,
        instructions: d.instructions?.trim() || null,
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/admin/settings");
    revalidatePath("/panel/odenis/[id]", "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Yadda saxlanmadı." };
  }
}

/**
 * Server action wrapper so the client ReceiptViewer can fetch a fresh signed URL
 * on demand (short-lived, admin-only — enforced in getReceiptSignedUrl).
 */
export async function fetchReceiptUrl(path: string): Promise<string | null> {
  return getReceiptSignedUrl(path);
}
