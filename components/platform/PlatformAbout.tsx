import { SectionHeading } from "./SectionHeading";

const POINTS = [
  {
    title: "Düşünməyə yönəlik",
    text: "İmtahanlar yaddaş yoxlaması deyil — onlar səni ideya axtarmağa və məsələni dərindən anlamağa vadar edir.",
  },
  {
    title: "Zəif tərəflərini aşkar et",
    text: "Hər sınaqda səhvlərini gör, onları araşdır və növbəti dəfə daha yaxşı hazırlaş.",
  },
  {
    title: "Motivasiya ilə irəlilə!",
    text: "Uğursuzluqların səni dayandırmasına imkan vermə. Hər səhv bir dərsdir və hər dərs səni daha güclü edir.",
  },
];

/** Concise "what this platform is" section. No filler, no fabricated numbers. */
export function PlatformAbout() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <SectionHeading
        eyebrow="Platforma haqqında"
        title="Bizim Məqsədimiz"
        description="Bu platforma tamamilə olimpiadalara hazırlaşmaq məqsədiylə şagirdlərə dəstək olmaq üçün yaradılıb. Burada məqsədimiz şagirdlərin riyaziyyat bacarıqlarını inkişaf etdirmək və onları real imtahan şəraitinə hazırlamaqdır."
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
