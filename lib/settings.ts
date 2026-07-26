import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Platform payment settings (bank details + instructions shown on the payment
 * page). Read with the cookie client — RLS allows any signed-in user to read
 * them (a student needs them to pay), and only admins to write. Holds NO
 * secrets: bank name / card number / account holder / instructions only.
 */

export interface PlatformSettings {
  bank_name: string | null;
  card_number: string | null;
  account_holder: string | null;
  instructions: string | null;
}

const EMPTY: PlatformSettings = {
  bank_name: null,
  card_number: null,
  account_holder: null,
  instructions: null,
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (!isSupabaseConfigured) return EMPTY;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select("bank_name, card_number, account_holder, instructions")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return EMPTY;
    return data as PlatformSettings;
  } catch {
    return EMPTY;
  }
}

/** True once the teacher has entered at least a card number. */
export function paymentConfigured(s: PlatformSettings): boolean {
  return Boolean(s.card_number && s.card_number.trim());
}
