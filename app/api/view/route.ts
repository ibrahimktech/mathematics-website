import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { hashIp, bakuViewDay } from "@/lib/analytics/ip";
import { getClientIp, isSameOrigin } from "@/lib/security/request";
import { consume, RATE_RULES } from "@/lib/security/rate-limit";

/**
 * Records ONE blog-article view. Fire-and-forget beacon from the article page
 * (ViewBeacon). Writes with the service role (blog_views has no client write
 * policy) after hashing the caller's IP, and de-duplicates per (post, IP-hash,
 * Baku day) via the table's unique constraint — so refreshing never inflates
 * counts. Always returns 204 (never leaks state / errors to the client).
 *
 * The visitor IP is read from the platform's proxy headers, NOT the request
 * body, so it can't be spoofed by the client. Non-existent post ids are rejected
 * by the FK (post_id → posts) — no bogus rows.
 */
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    if (!isServiceRoleConfigured) return new NextResponse(null, { status: 204 });

    /**
     * CSRF: this is a plain route handler, so it does not get the Origin/Host
     * check that Next.js applies to Server Actions. Without it, any site could
     * make its visitors' browsers POST here. The write is low-impact (a view
     * count), but a state-changing endpoint should still refuse cross-site calls.
     */
    if (!isSameOrigin(request)) return new NextResponse(null, { status: 204 });

    // Cap how fast one address can register views, so the counter can't be
    // driven up in a loop even across many different articles.
    const ip = getClientIp(request.headers);
    if (!consume(`view:${ip}`, RATE_RULES.viewBeacon).allowed) {
      return new NextResponse(null, { status: 204 });
    }

    let postId = "";
    try {
      const body = await request.json();
      postId = typeof body?.postId === "string" ? body.postId : "";
    } catch {
      return new NextResponse(null, { status: 204 });
    }
    if (!UUID_RE.test(postId)) return new NextResponse(null, { status: 204 });

    const ipHash = hashIp(ip);
    const viewDay = bakuViewDay();

    const admin = createAdminClient();
    await admin.from("blog_views").upsert(
      { post_id: postId, ip_hash: ipHash, view_day: viewDay },
      { onConflict: "post_id,ip_hash,view_day", ignoreDuplicates: true },
    );
  } catch {
    // Analytics must never affect the reader — swallow everything.
  }
  return new NextResponse(null, { status: 204 });
}
