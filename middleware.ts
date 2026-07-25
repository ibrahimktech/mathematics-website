import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Only run on admin routes — the public site needs no auth.
  matcher: ["/admin/:path*"],
};
