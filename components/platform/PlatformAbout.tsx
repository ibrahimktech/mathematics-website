import { SectionHeading } from "./SectionHeading";

const POINTS = [
  {
    title: "Düşünməyə yönəlik",
    text: "İmtahanlar yaddaş yoxlaması deyil — onlar səni ideya axtarmağa və məsələni dərindən anlamağa vadar edir.",
  },
  {
    title: "Zəif tərəfləri aşkar et",
    text: "Hər imtahan hansı mövzuları möhkəmləndirməli olduğunu aydın göstərir, beləliklə vaxtını doğru yerə yönəldirsən.",
  },
  {
    title: "Addım-addım inkişaf",
    text: "Başlanğıc səviyyəsindən olimpiadaya qədər çətinlik pillələri — hazır olduğun tempdə irəlilə.",
  },
];

/** Concise "what this platform is" section. No filler, no fabricated numbers. */
export function PlatformAbout() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <SectionHeading
        eyebrow="Platforma haqqında"
        title="Riyazi məsələ həllini ciddiyə alanlar üçün"
        description="Bu platforma diqqətlə hazırlanmış imtahanlar və məsələlər vasitəsilə tələbələrin problem həlli bacarığını inkişaf etdirmək üçün qurulub. Məqsəd yüksək bal deyil — daha aydın və dərin düşünməkdir."
      />

      <div className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
        {POINTS.map((p) => (
          <div key={p.title} className="border-primary/60 border-t pt-5">
            <h3 className="font-display text-foreground text-lg font-bold tracking-tight">
              {p.title}
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {p.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
