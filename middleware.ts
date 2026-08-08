import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on the admin panel (allow-list) plus the member areas that need only an
  // account: the student dashboard and the resource library. `/resurslar` sits
  // in the PUBLIC nav but its page is members-only, so the middleware is what
  // turns an anonymous click into a login redirect. Keep this in step with
  // MEMBER_AREAS in lib/supabase/middleware.ts. The rest of the public site
  // needs no auth and is intentionally excluded.
  // `/resurslar` is listed on its own as well as with `:path*` — the bare path
  // is the one visitors actually click, and it is not worth depending on
  // zero-segment matching for an authorization gate.
  matcher: ["/admin/:path*", "/panel/:path*", "/resurslar", "/resurslar/:path*"],
};
