/** Shared primary navigation for the platform (navbar, mobile menu, footer). */

export type NavItem = {
  href: string;
  label: string;
  /** Extra path prefixes that should also mark this item active. */
  also?: string[];
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/imtahanlar", label: "İmtahanlar" },
  /**
   * Shown to everyone on purpose, even though the page itself needs an account:
   * visitors can't want a library they never see. An anonymous click lands on
   * `/daxil-ol?redirect=/resurslar` and comes straight back after sign-in.
   */
  { href: "/resurslar", label: "Resurslar" },
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
