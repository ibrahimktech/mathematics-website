"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  TURNSTILE_SITE_KEY,
  isTurnstileConfigured,
} from "@/lib/security/turnstile";

/**
 * Cloudflare Turnstile widget, shared by every authentication form.
 *
 * Built directly on Cloudflare's documented explicit-rendering API
 * (`turnstile.render` / `reset` / `remove`) rather than a wrapper package — the
 * surface we need is small and stable, and this project keeps its dependency
 * list deliberately short.
 *
 * The token this produces is passed to Supabase as `options.captchaToken`.
 * Supabase Auth is what verifies it against Cloudflare; nothing here decides
 * whether a token is good. See `lib/security/turnstile.ts` for why that split
 * matters (short version: a token can only be verified once).
 *
 * `appearance: "interaction-only"` keeps the widget at zero height for normal
 * visitors — it solves silently in the background and only becomes visible if
 * Cloudflare decides this visitor has to prove something. That is why the auth
 * pages' `<Suspense>` fallback heights did not need to change.
 *
 * With no site key configured the component renders nothing and
 * `useTurnstileToken().enabled` is false, so the forms behave exactly as they
 * did before Turnstile existed (same graceful-degradation contract as
 * `isSupabaseConfigured`).
 */

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type RenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  appearance?: "always" | "execute" | "interaction-only";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  "error-callback"?: (code?: string) => boolean | void;
  "before-interactive-callback"?: () => void;
  "after-interactive-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: RenderOptions) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Load api.js exactly once per page, however many widgets ask for it.
 * Memoising the promise (rather than the script tag) also makes React's
 * StrictMode double-mount a no-op instead of a second network request.
 */
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("turnstile: not in a browser"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");

    const onLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("turnstile: script loaded but api missing"));
    };
    const onError = () => {
      // Let a later attempt retry from scratch instead of caching the failure.
      scriptPromise = null;
      reject(new Error("turnstile: script failed to load"));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
}

export type TurnstileHandle = {
  /** Discard the current token and ask Cloudflare for a fresh one. */
  reset: () => void;
};

export type TurnstileFieldProps = {
  /** Receives every new token, and `""` whenever the current one stops being usable. */
  onToken: (token: string) => void;
  /** Called once if the widget cannot run at all (script blocked, offline, CSP). */
  onUnavailable?: () => void;
  /** Labels this flow in the Cloudflare analytics dashboard. `[a-zA-Z0-9_-]`, ≤32 chars. */
  action?: string;
  ref?: React.Ref<TurnstileHandle>;
  className?: string;
};

export function TurnstileField({
  onToken,
  onUnavailable,
  action,
  ref,
  className,
}: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  /**
   * Whether Cloudflare is actually showing something. In `interaction-only` mode
   * the widget stays invisible for almost everyone, and it should then cost the
   * form no vertical space at all — so the gap below it only appears once
   * Cloudflare says it needs this visitor. The container itself is always
   * rendered and never `display: none`: an iframe inside a hidden subtree is not
   * reliably loaded across browsers, and a widget that cannot solve is a widget
   * that blocks sign-up.
   */
  const [interactive, setInteractive] = useState(false);

  // Callbacks live in refs so re-renders never force the widget to be rebuilt:
  // a rebuild would throw away a challenge the visitor is part-way through.
  const onTokenRef = useRef(onToken);
  const onUnavailableRef = useRef(onUnavailable);
  onTokenRef.current = onToken;
  onUnavailableRef.current = onUnavailable;

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        const id = widgetIdRef.current;
        if (!id || !window.turnstile) return;
        try {
          // Discards the spent token; the success callback fires again with a
          // new one, so a second submit attempt has something valid to send.
          window.turnstile.reset(id);
        } catch {
          // Widget already torn down — the next mount will issue a fresh token.
        }
      },
    }),
    [],
  );

  useEffect(() => {
    if (!isTurnstileConfigured) return;

    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current =
          turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            action,
            // The site is light-only by spec, so pin the widget instead of
            // letting it follow the OS and render a dark box on a white card.
            theme: "light",
            appearance: "interaction-only",
            callback: (token) => onTokenRef.current(token),
            // Tokens last 300s. Clearing on expiry means a form left open on a
            // desk submits a fresh token rather than a dead one; Turnstile
            // re-arms itself automatically.
            "expired-callback": () => onTokenRef.current(""),
            "timeout-callback": () => onTokenRef.current(""),
            "error-callback": () => {
              onTokenRef.current("");
              onUnavailableRef.current?.();
              // false → let Turnstile show its own retry affordance.
              return false;
            },
            // Cloudflare needs this visitor to do something: take up space.
            "before-interactive-callback": () => setInteractive(true),
            "after-interactive-callback": () => setInteractive(false),
          }) ?? null;
      })
      .catch(() => {
        if (cancelled) return;
        onTokenRef.current("");
        onUnavailableRef.current?.();
      });

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          // Already gone (fast unmount / double-invoked effect) — nothing to do.
        }
      }
    };
    // `action` is a per-form constant; re-running on a changed callback identity
    // would needlessly rebuild the widget, which is what the refs above prevent.
  }, [action]);

  if (!isTurnstileConfigured) return null;

  /**
   * Render this immediately above the submit button, inside a plain wrapper
   * rather than as a member of the form's `space-y-*` stack — that way a silent
   * widget (height 0, no margin) leaves the layout byte-for-byte as it was, and
   * a visible challenge gets its own gap from `mb-4`.
   */
  return (
    <div ref={containerRef} className={interactive ? `mb-4 ${className ?? ""}` : undefined} />
  );
}

/* ------------------------------------------------------------------- hook -- */

export type TurnstileToken = {
  /** False when no site key is configured — the forms then skip the captcha entirely. */
  enabled: boolean;
  /** Props to spread onto `<TurnstileField />`. */
  fieldProps: Pick<TurnstileFieldProps, "onToken" | "onUnavailable" | "ref">;
  /**
   * The current token, waiting up to `timeoutMs` for the invisible widget to
   * finish if it has not produced one yet. Resolves `""` on timeout or when
   * Turnstile is unavailable — callers decide what to say about that.
   */
  waitForToken: (timeoutMs?: number) => Promise<string>;
  /** True once the widget has failed outright (blocked, offline, CSP). */
  unavailable: () => boolean;
  /** Spend-and-replace. Call after EVERY failed submit: the token is gone by then. */
  reset: () => void;
};

const DEFAULT_WAIT_MS = 8000;

/**
 * Owns the token state for one form, so the four auth forms share this logic
 * instead of keeping four copies of the same three `useState`s.
 */
export function useTurnstileToken(): TurnstileToken {
  const handleRef = useRef<TurnstileHandle | null>(null);
  const tokenRef = useRef("");
  const unavailableRef = useRef(false);
  // Submits that arrived before the widget finished, waiting to be handed a token.
  const waitersRef = useRef<((token: string) => void)[]>([]);

  const onToken = useCallback((token: string) => {
    tokenRef.current = token;
    if (!token) return;
    unavailableRef.current = false;
    // A token cancels the "unavailable" state and releases anyone blocked on it.
    for (const resolve of waitersRef.current.splice(0)) resolve(token);
  }, []);

  const onUnavailable = useCallback(() => {
    unavailableRef.current = true;
    // Don't strand a pending submit behind the full timeout when we already know.
    for (const resolve of waitersRef.current.splice(0)) resolve("");
  }, []);

  const waitForToken = useCallback(
    (timeoutMs: number = DEFAULT_WAIT_MS): Promise<string> => {
      if (!isTurnstileConfigured) return Promise.resolve("");
      if (tokenRef.current) return Promise.resolve(tokenRef.current);
      if (unavailableRef.current) return Promise.resolve("");

      return new Promise<string>((resolve) => {
        const waiter = (token: string) => {
          clearTimeout(timer);
          resolve(token);
        };
        const timer = setTimeout(() => {
          waitersRef.current = waitersRef.current.filter((w) => w !== waiter);
          resolve("");
        }, timeoutMs);
        waitersRef.current.push(waiter);
      });
    },
    [],
  );

  const reset = useCallback(() => {
    tokenRef.current = "";
    handleRef.current?.reset();
  }, []);

  // Never leave a promise hanging if the form unmounts mid-submit.
  useEffect(
    () => () => {
      for (const resolve of waitersRef.current.splice(0)) resolve("");
    },
    [],
  );

  const [fieldProps] = useState(() => ({
    onToken,
    onUnavailable,
    ref: handleRef,
  }));

  return {
    enabled: isTurnstileConfigured,
    fieldProps,
    waitForToken,
    unavailable: () => unavailableRef.current,
    reset,
  };
}
