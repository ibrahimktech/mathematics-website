import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

/**
 * Origins the browser is allowed to talk to. Derived from the configured
 * Supabase project so the CSP does not have to allow "any https host".
 */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");

/**
 * Cloudflare Turnstile. The bot-protection widget on the auth forms loads
 * api.js from here and renders its challenge in an iframe served from the same
 * origin, so it needs script-src + frame-src + connect-src. Without all three
 * the widget fails silently and NOBODY CAN SIGN UP — the token never arrives,
 * and Supabase Auth rejects the request for want of a captcha.
 */
const turnstileOrigin = "https://challenges.cloudflare.com";

/**
 * Content-Security-Policy.
 *
 * `script-src` keeps `'unsafe-inline'` on purpose: the App Router streams the
 * RSC payload through inline `<script>` tags, and the only way to drop it is a
 * per-request nonce injected from middleware — which forces EVERY page to render
 * dynamically and would destroy the static/ISR public site this project is built
 * around. Everything else is locked down hard instead, so an injected inline
 * script still cannot load remote code, exfiltrate to another host, reframe the
 * page, or retarget a form:
 *   • `object-src 'none'`   — no plugin/embed script execution vectors
 *   • `base-uri 'self'`     — an injected <base> cannot re-root relative URLs
 *   • `form-action 'self'`  — a login form cannot be repointed at an attacker
 *   • `frame-ancestors 'none'` — clickjacking (the modern X-Frame-Options)
 *   • `connect-src` allow-list — XHR/fetch/WebSocket only to us and Supabase
 * See the security report for the nonce migration path if the public site ever
 * stops needing static generation.
 */
function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-eval' is required by React Fast Refresh in `next dev` only.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      turnstileOrigin,
      ...(isProd ? [] : ["'unsafe-eval'"]),
    ],
    // Tailwind v4 and KaTeX both emit inline style attributes.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(supabaseOrigin ? [supabaseOrigin] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...(supabaseOrigin ? [supabaseOrigin, supabaseWs] : []),
      turnstileOrigin,
      ...(isProd ? [] : ["ws:", "http://localhost:*"]),
    ],
    // Receipt PDFs open from Supabase signed URLs; the Turnstile challenge is
    // an iframe we embed (frame-ancestors 'none' still stops anyone framing US).
    "frame-src": [
      "'self'",
      ...(supabaseOrigin ? [supabaseOrigin] : []),
      turnstileOrigin,
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");

  return isProd ? `${policy}; upgrade-insecure-requests` : policy;
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  // Legacy clickjacking defence for browsers that predate frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME sniffing — an uploaded receipt must never be executed as HTML/JS.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Full URL to ourselves, only the origin to third parties, nothing over a
  // downgrade — keeps `?redirect=` and signed-URL paths out of Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny hardware/ambient APIs the site never uses.
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Isolate this origin from cross-origin window handles / popups.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// HSTS only in production: sending it from http://localhost would pin the
// developer's browser to https for localhost and break `next dev`.
if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  // Pin the tracing root to this project (a stray lockfile exists in the home dir).
  outputFileTracingRoot: path.join(__dirname),
  // Never leak the framework version in a response header.
  poweredByHeader: false,
  experimental: {
    /**
     * Server Actions already reject cross-origin POSTs by comparing Origin to
     * Host. Behind a proxy that rewrites Host, that check needs the real public
     * origin spelled out — otherwise it either breaks or has to be relaxed.
     */
    serverActions: {
      allowedOrigins: [
        ...(() => {
          try {
            return [new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host];
          } catch {
            return [];
          }
        })(),
        ...(isProd ? [] : ["localhost:3000", "localhost:4319"]),
      ],
      bodySizeLimit: "6mb", // receipts are capped at 5 MB by the upload action
    },
  },
  images: {
    // Supabase Storage public bucket URLs, e.g.
    // https://<project-ref>.supabase.co/storage/v1/object/public/article-images/...
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      // Every route, including static assets and the ISR public site.
      { source: "/:path*", headers: securityHeaders },
      /**
       * Authenticated areas must never be stored by a browser cache, a CDN or a
       * corporate proxy — a cached /panel page is one student's dashboard served
       * to the next visitor. The pages are already `force-dynamic`; this makes
       * the no-store contract explicit at the HTTP layer.
       */
      {
        source: "/panel/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
          // Keep the admin panel out of search indexes entirely.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
