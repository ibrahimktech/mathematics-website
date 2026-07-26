import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on the admin panel (allow-list) and the student dashboard (any user).
  // The public site needs no auth and is intentionally excluded.
  matcher: ["/admin/:path*", "/panel/:path*"],
};
