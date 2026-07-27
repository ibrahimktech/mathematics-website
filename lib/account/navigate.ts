/**
 * Leaving an auth page (login / sign-up / password reset) for the signed-in area.
 *
 * WHY A FULL DOCUMENT NAVIGATION AND NOT `router.replace()`:
 *
 *   • Sign-in happens in the BROWSER (see `lib/supabase/client.ts`), so the
 *     session cookie is written with `document.cookie` a moment before we
 *     navigate. `/panel/*` is gated twice on the server — `middleware.ts` and
 *     the `requireUser()` call in the panel layout. A real request is the only
 *     thing that guarantees both of those see the cookie that was just written;
 *     a soft navigation only refetches an RSC payload.
 *   • These forms used to call `router.replace(target)` and `router.refresh()`
 *     back to back. Both start a transition, and the refresh — which targets the
 *     route we are trying to LEAVE — can pre-empt the navigation, so the user
 *     stays on the login form with no error and no redirect. A full navigation
 *     re-renders every server component anyway, so the refresh is redundant.
 *
 * `replace`, not `assign`: Back must not return to the login form.
 *
 * The module-level flag makes this idempotent. Both the submit handler and the
 * "already signed in" effect can reach it in the same tick, and reloading the
 * document twice would be a visible flash.
 */
let navigating = false;

export function navigateAfterAuth(path: string): void {
  if (typeof window === "undefined" || navigating) return;
  navigating = true;
  window.location.replace(path);
}
