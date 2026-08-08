/* =============================================================================
 * PLATFORMA MƏTNLƏRİ və MÜƏLLİM MƏLUMATI (NÜMUNƏ / PLACEHOLDER)
 * -----------------------------------------------------------------------------
 * Bütün platforma nümunə mətnləri və müəllim məlumatı BİR yerdə toplanıb ki,
 * real məlumatı asanlıqla əvəz edə biləsiniz. Heç bir uydurma iddia (məsələn,
 * "10 000 tələbə", "98% uğur") istifadə olunmayıb — yalnız platformanın nə
 * etdiyini izah edən mətnlər.
 * ========================================================================== */

/** Müəllim bölməsi. Real ad, vəzifə, bioqrafiya və foto ilə əvəz edin. */
export const TEACHER = {
  /** Müəllimin adı — real ad ilə əvəz edin. */
  name: "Camal Qədirov",
  /** Qısa vəzifə/başlıq. */
  title: "Riyaziyyat Olimpiada müəllimi",
  /**
   * Müəllimin fotosu (`/public` qovluğundan). Hazırda `hero-image.png` istifadə
   * olunur; başqa şəkil üçün yolu dəyişin. Boş qaldıqda zərif yer tutucu görünür.
   */
  photo: "/hero-image.png",
  /** Bioqrafiya abzasları — real mətnlə əvəz edin (uydurma nailiyyət yazmayın). */
  bio: [
    "Camal Qədirov, riyaziyyat təhsili sahəsində 10 ildən çox təcrübəyə malikdir. O, şagirdlərə riyazi düşüncə və problem həll etmə bacarıqlarını inkişaf etdirməkdə kömək edir.",
    "Onun məqsədi, şagirdlərin analitik bacarıqlarını gücləndirmək və imtahanlarda uğur qazanmalarıdır. Camal müəllimin şagirdləri bir çox yerli və beynəlxalq riyaziyyat olimpiadalarında uğur qazanırlar.",
  ],
} as const;

/** Ana səhifə üçün əsas mətnlər. İstədiyiniz kimi dəyişin. */
export const PLATFORM = {
  eyebrow: "Riyaziyyat təhsil platforması",
  headline: "Riyaziyyat fənni üzrə olimpiadalara hazırlıq",
  subheadline:
    "Devler gibi eserler üretebilmek için, karıncalar gibi çalışmak lazım... (NFK)",
  /** "Necə işləyir?" addımları. */
  steps: [
    {
      n: "01",
      title: "İmtahan seç",
      text: "Mövzuya və çətinliyə görə sənə uyğun imtahanı seç.",
    },
    {
      n: "02",
      title: "Həll et",
      text: "Məsələləri vaxt daxilində, real imtahan ritmində həll et.",
    },
    {
      n: "03",
      title: "Nəticəni nəzərdən keçir",
      text: "Zəif tərəflərini gör, səhvlərini araşdır və inkişaf et.",
    },
  ],
} as const;
