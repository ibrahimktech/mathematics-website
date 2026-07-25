import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-primary font-display text-6xl font-bold">404</p>
      <h1 className="font-display mt-4 text-2xl font-bold">
        Səhifə tapılmadı
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Axtardığınız səhifə mövcud deyil və ya köçürülüb.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary-hover mt-8 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
      >
        Ana Səhifəyə qayıt
      </Link>
    </div>
  );
}
