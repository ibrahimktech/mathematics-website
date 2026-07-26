"use client";

import { useEffect, useRef } from "react";

/**
 * Fire-and-forget view beacon. Records one article view via /api/view after
 * hydration, so the article page itself stays static/ISR (no per-request work).
 * De-duplication happens server-side (per IP-hash per day), so this firing once
 * per page load is fine. Renders nothing.
 */
export function ViewBeacon({ postId }: { postId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !postId) return;
    sent.current = true;
    // keepalive lets the request finish even if the user navigates away.
    void fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
      keepalive: true,
    }).catch(() => {});
  }, [postId]);
  return null;
}
