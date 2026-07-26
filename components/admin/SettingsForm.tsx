"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings } from "@/lib/actions/settings";
import type { PlatformSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const router = useRouter();
  const [bankName, setBankName] = useState(initial.bank_name ?? "");
  const [cardNumber, setCardNumber] = useState(initial.card_number ?? "");
  const [holder, setHolder] = useState(initial.account_holder ?? "");
  const [instructions, setInstructions] = useState(initial.instructions ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await saveSettings({
      bank_name: bankName,
      card_number: cardNumber,
      account_holder: holder,
      instructions,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Tənzimləmələr yadda saxlanıldı");
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="bank">Bank adı</Label>
          <Input
            id="bank"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Məsələn: Kapital Bank"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="holder">Hesab sahibi</Label>
          <Input
            id="holder"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="Ad Soyad"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="card">Kart / hesab nömrəsi</Label>
        <Input
          id="card"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="0000 0000 0000 0000"
          className="mt-1.5 font-mono"
        />
      </div>

      <div>
        <Label htmlFor="instructions">Ödəniş təlimatı</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
          placeholder="Köçürməni etdikdən sonra qəbzi yükləyin. Ödəniş əl ilə yoxlanılır."
          className="mt-1.5"
        />
        <p className="text-muted-foreground mt-1.5 text-xs">
          Bu məlumat tələbələrə ödəniş səhifəsində göstərilir. Gizli açar / parol
          yazmayın — yalnız ödəniş rekvizitləri.
        </p>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />} Yadda saxla
      </Button>
    </div>
  );
}
