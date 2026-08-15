"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * What the signed-in visitor's relationship to the exam catalogue looks like.
 *
 * - `loading`   — server render + pre-hydration (also the constant server
 *                 snapshot, so hydration always matches the static HTML).
 * - `signedOut` — no session (or Supabase not configured).
 * - `ready`     — `ownedIds` are exams with an `exam_access` grant and
 *                 `pendingIds` are exams with a pending purchase request.
 */
export type OwnershipSnapshot =
  | { status: "loading" }
  | { status: "signedOut" }
  | {
      status: "ready";
      ownedIds: ReadonlySet<string>;
      pendingIds: ReadonlySet<string>;
    };

const LOADING: OwnershipSnapshot = { status: "loading" };
const SIGNED_OUT: OwnershipSnapshot = { status: "signedOut" };

/**
 * Module-level store so a page full of exam cards, the purchase panel and the
 * banner all share ONE pair of queries instead of one per component. Public
 * exam pages are static/ISR and cookie-less on purpose (see
 * `lib/supabase/public.ts`), so ownership can only be known on the client —
 * same pattern as `useSessionUser`. RLS scopes both reads to the caller's own
 * rows ("Users read own access" / "Users read own purchases").
 */
let snapshot: OwnershipSnapshot = isSupabaseConfigured ? LOADING : SIGNED_OUT;
const listeners = new Set<() => void>();
let started = false;
/** `undefined` = not resolved yet; `null` = signed out; string = user id. */
let currentUserId: string | null | undefined;
/** Bumped per (re)load so a stale fetch can't overwrite a newer state. */
let generation = 0;

function emit(next: OwnershipSnapshot) {
  snapshot = next;
  for (const l of listeners) l();
}

async function load(userId: string) {
  const gen = ++generation;
  const supabase = createClient();
  try {
    const [access, pending] = await Promise.all([
      supabase.from("exam_access").select("exam_id"),
      supabase.from("purchases").select("exam_id").eq("status", "pending"),
    ]);
    if (gen !== generation || currentUserId !== userId) return;
    const ids = (rows: { exam_id: string }[] | null) =>
      new Set((rows ?? []).map((r) => r.exam_id));
    emit({
      status: "ready",
      ownedIds: ids(access.data),
      pendingIds: ids(pending.data),
    });
  } catch {
    // Degrade to "owns nothing": every component then renders the same
    // neutral markup a signed-out visitor gets — never a crash.
    if (gen !== generation || currentUserId !== userId) return;
    emit({ status: "ready", ownedIds: new Set(), pendingIds: new Set() });
  }
}

function setUser(userId: string | null) {
  if (userId === currentUserId) return;
  currentUserId = userId;
  if (!userId) {
    generation++; // cancel any in-flight load
    emit(SIGNED_OUT);
  } else {
    void load(userId);
  }
}

function start() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  const supabase = createClient();

  supabase.auth
    .getUser()
    .then(({ data }) => setUser(data.user?.id ?? null))
    .catch(() => setUser(null));

  // Kept for the lifetime of the page (the navbar holds a client session on
  // every page anyway): badges flip without a refresh when the user signs in
  // or out. The user-id guard in `setUser` ignores token refreshes.
  supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user?.id ?? null);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => LOADING;

/**
 * Client-side exam ownership for the PUBLIC catalogue. Components must render
 * their existing neutral markup (or nothing) for `loading` and `signedOut` so
 * the first client render equals the static HTML, and only upgrade on `ready`.
 */
export function useExamOwnership(): OwnershipSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
