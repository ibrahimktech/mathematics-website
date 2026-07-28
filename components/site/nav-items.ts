/** Shared primary navigation for the platform (navbar, mobile menu, footer). */

export type NavItem = {
  href: string;
  label: string;
  /** Extra path prefixes that should also mark this item active. */
  also?: string[];
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/imtahanlar", label: "İmtahanlar" },
  {
    href: "/bloq",
    label: "Bloq",
    also: ["/meqale", "/kateqoriya", "/axtar"],
  },
  { href: "/haqqinda", label: "Haqqında" },
];

/** Whether `pathname` should mark `item` as the active nav entry. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (pathname.startsWith(item.href + "/")) return true;
  return (item.also ?? []).some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
