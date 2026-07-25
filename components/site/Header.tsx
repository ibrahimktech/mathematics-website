import Link from "next/link";
import { getCategoriesWithCount } from "@/lib/categories";
import { getPublishedPosts } from "@/lib/posts";
import { SearchBar } from "./SearchBar";
import { MobileMenu } from "./MobileMenu";
import { HeaderShell } from "./HeaderShell";
import { SITE } from "@/lib/site";

export async function Header() {
  const [categories, recent] = await Promise.all([
    getCategoriesWithCount(),
    getPublishedPosts(5),
  ]);

  return (
    <HeaderShell
      brand={
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2"
          aria-label={SITE.name}
        >
          <span
            aria-hidden
            className="bg-primary text-primary-foreground font-heading grid size-9 place-items-center rounded-xl text-lg font-bold shadow-sm transition-transform group-hover:-translate-y-0.5"
          >
            π
          </span>
          <span className="font-display text-foreground text-lg font-bold tracking-tight">
            {SITE.name}
          </span>
        </Link>
      }
      search={<SearchBar />}
      mobile={<MobileMenu categories={categories} recent={recent} />}
    />
  );
}
