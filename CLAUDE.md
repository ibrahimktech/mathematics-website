# CLAUDE.md — Mathematics Blog

Azerbaijani mathematics blog. Single admin (the teacher) writes **pure LaTeX**
articles (whole `\documentclass … \end{document}` documents render as typeset HTML);
public site is read-only. Spec: `BLOG_SYSTEM_V1_SPEC.md` (note: the editor is LaTeX,
not Markdown as the original spec said — changed per the user's request).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS **v4** (CSS-based
config in `app/globals.css`, palette as CSS variables) · shadcn/ui **"base-nova"
style built on Base UI** (NOT Radix) · Supabase (Postgres + Auth + Storage) via
`@supabase/ssr` · custom **LaTeX→HTML transpiler** (`lib/latex/render.ts`) using
**KaTeX** for math · fonts: Merriweather (headings + article body) + Inter (UI).

## Commands

```bash
npm run dev            # ports 3000 AND 3001 are used by other apps → use: npm run dev -- -p 4319
npm run build          # production build (also lints + typechecks)
npm run lint
```

Verify UI without Supabase: pages degrade to empty states (never crash). To test
the LaTeX renderer in isolation, temporarily add a `(public)/<name>/page.tsx`
rendering `<LatexContent content={...}/>` and curl it (do NOT prefix the folder
with `_` — underscore = Next private folder = 404).

## Architecture — important specifics

- **Public reads are cookie-less** (`lib/supabase/public.ts`) so public pages stay
  static/ISR (`export const revalidate = 300`). Mutations call `revalidatePath("/")`,
  `revalidatePath("/meqale/[slug]","page")`, etc. **Do NOT wrap reads in
  `unstable_cache`.** Public data access: `lib/posts.ts`, `lib/categories.ts`.
- **Admin reads use the cookie server client** (`lib/supabase/server.ts`); admin
  pages set `export const dynamic = "force-dynamic"`. Admin data: `lib/admin/queries.ts`.
- **Auth/RLS (admin = allow-list, NOT just "authenticated"):** admins are the
  user IDs in `public.admins`; the `public.is_admin()` SECURITY DEFINER function
  is the single source of truth, checked in three layers — (1) `middleware.ts`
  guards `/admin/*` (unauth → `/daxil-ol`, authed-but-not-admin → `/`),
  (2) the `(dashboard)` layout calls `requireAdminPage()` (`lib/admin/auth.ts`)
  as the authoritative per-request gate, (3) RLS in `supabase/schema.sql` gates
  every write (posts, categories, storage) and all draft reads on `is_admin()`.
  **There is no separate admin login page** — admins sign in through the shared
  `/daxil-ol` login like any user; membership in `public.admins` unlocks the panel
  (surfaced as the "Admin panel" nav link in `AccountMenu`). Actions in
  `lib/actions/*` re-check via `isAdmin(supabase)` and validate with zod. Grant
  admin by inserting into
  `public.admins` from the SQL editor (see the bottom of `schema.sql`) — there
  are no write RLS policies on that table, so the anon key can't touch it. Only
  the anon key ever reaches the client; the service-role key is unused in code.
- **LaTeX rendering:** `lib/latex/render.ts` transpiles a LaTeX subset → HTML
  (preamble ignored; `\maketitle`, numbered `\section`/`\subsection`, `equation`
  numbering + `\eqref`/`\ref`/`\label`, `align`/`gather`, theorem-like envs +
  `proof` with QED, `abstract`, `itemize`/`enumerate`, `tabular`, `figure`,
  `\textbf`/`\emph`/…; all math via KaTeX). Isomorphic + graceful (unknown
  commands render their arg, unknown envs render their body, KaTeX
  `throwOnError:false`). `components/site/LatexContent.tsx` has **no `"use client"`**
  — server-rendered on article pages (minimal JS) and reused in the client editor's
  **deferred** preview (`useDeferredValue`), so preview == published output. Styling:
  `.latex-article` in `app/globals.css`. Output goes through `dangerouslySetInnerHTML`;
  the transpiler escapes all text nodes and sanitizes URLs.
- **shadcn is Base UI, not Radix:** `Button` has **no `asChild`**. For a link that
  looks like a button use `buttonVariants()` on a `<Link>`/`<a>`. Native `<select>`
  is used (not the Base UI Select) to keep the ArticleForm simple/robust.
- **Slugs** are ASCII-transliterated from Azerbaijani (`lib/slug.ts`, ə→e, ş→s…);
  everything else (titles, search, tags, categories) keeps full UTF-8. Search uses
  a Postgres `tsvector` (`simple` config, UTF-8 safe) **maintained by a trigger**
  — NOT a generated column (`array_to_string` over `tags` isn't IMMUTABLE → 42P17).
- **Graceful degradation:** data functions check `isSupabaseConfigured` and return
  `[]`/`null`, so `npm run build` succeeds with no credentials.

## Platform (exams + manual purchases + student accounts)

The project is **one brand with two halves**: the free blog and a paid-exam
platform. Everything exam-related is **database-driven** (admin-created); nothing
is hardcoded. Routing (all Azerbaijani):
- `/` — platform homepage. `/bloq` — blog landing (old `/`; article URLs unchanged).
- `/imtahanlar` + `/imtahanlar/[slug]` — exam catalogue (published only, slug URLs).
- `/meseleler` — free practice. `/qeydiyyat`,`/daxil-ol` (auth), `/panel` (dashboard).
- `/panel/odenis/[id]` — manual bank-transfer payment page (focused).
- Admin: `/admin/exams`, `/admin/purchases`, `/admin/settings` (+ blog admin).

- **Exams live in the DB, not code.** `lib/exams.ts` (server-only) reads the
  `exams` table via the cookie-less public client → RLS returns only **published**
  exams (static/ISR-safe). Client-safe types + display helpers are split out
  (`lib/exams/types.ts`, `lib/exams/display.ts`) so client components don't pull
  `server-only`. The old `lib/exams/data.ts`/`questions.ts`/`answer-key.ts` are
  **gone**. `exams.category_slug` matches a blog category slug → exam↔blog links.
- **Questions + answers never leak.** `exam_questions` is **admin-only** at the
  table level (RLS). Students receive answer-free questions ONLY through the
  SECURITY DEFINER RPC `get_exam_questions(uuid)` (`lib/exams/questions.ts`),
  which first checks `has_exam_access()` (published AND (free OR an `exam_access`
  grant)). Grading reads `correct_index` server-side with the service role
  (`lib/exams/grade.ts`) — the one place answers are touched, never exposed.
  `price=0` NEVER bypasses the published check.
- **⚠️ REQUIRED: apply `supabase/exam-platform-schema.sql`** (SQL editor — DDL
  can't run from code). It **drops+recreates** `purchases` + `exam_attempts`
  (old sample data), adds `exams`, `exam_questions`, `exam_access`,
  `platform_settings`, extends `profiles` (email/first_name/last_name/
  student_number), and creates the **private `receipts` bucket**. Supersedes the
  old `platform-schema.sql` (kept only with a "SUPERSEDED" banner). Verify with
  `node scripts/security-test.mjs` (full authZ matrix; needs the migration).
- **Manual purchase workflow (pending→approved/denied).** Student submits on
  `/panel/odenis/[id]` (`PurchasePanel` → `submitPurchase` in
  `lib/student/actions.ts`): validates price/published from the DB, uploads the
  receipt (server-side magic-byte + size check) via the **cookie client** into
  the student's own private folder, inserts a **pending** `purchases` row via the
  cookie client under RLS (a student INSERT policy allows only own+pending — no
  service role for this ordinary op). An "I can't upload a receipt" checkbox sets
  `receipt_unavailable`. Admin reviews in `/admin/purchases` (`PurchaseTable`);
  `approvePurchase`/`denyPurchase` (`lib/actions/purchases.ts`) are **service-role**
  admin writes doing a **race-safe conditional update** (`where status='pending'`)
  and, on approve, an idempotent `exam_access` grant. Receipts open via
  short-lived **signed URLs** (`ReceiptViewer` → `fetchReceiptUrl`; storage RLS
  lets owner-or-admin read).
- **Access enforcement.** `startAttempt` re-checks `has_exam_access` (RPC) before
  creating an attempt (service-role, for score integrity); `submitAttempt`
  re-verifies attempt ownership then grades server-side. A student can never read
  another student's purchases/access/attempts/receipt (RLS), self-approve, or
  self-grant (no write policies on `purchases.status`/`exam_access`).
- **Admin authorization is the blog's model, reused unchanged:** `public.admins`
  allow-list + `is_admin()` (3 layers: middleware, `requireAdminPage()`, RLS).
  Every admin action re-checks `isAdmin(supabase)`. The client hook
  `use-user.ts` exposes `isAdmin` ONLY to show the "Admin panel" nav link — never
  a security boundary. Grant admin via `insert into public.admins` from SQL.
- **Payment settings** (`platform_settings`, singleton) hold DISPLAY-ONLY bank
  details shown on the payment page (authenticated read, admin write) — **never
  secrets**. Read via `lib/settings.ts`, edited in `/admin/settings`.
- **Student auth is client-side** (navbar reacts via `onAuthStateChange`).
  `requireUser` + `app/(public)/panel/layout.tsx` gate `/panel/*`; middleware
  matches `/admin/*`+`/panel/*`. `/panel` uses `.app-ui` (sans-serif).
- **Exam titles use a bold SANS-SERIF** via the `.exam-title` class (Inter),
  overriding the display serif on exam cards/detail/admin/runner. Math/LaTeX
  untouched. Exam catalogue keeps a denormalized `exams.question_count` (trigger)
  so public reads never touch the admin-only questions table.

## Analytics (admin-only)

- **Sales analytics** (`/admin/analytics/satis`) are derived from `purchases`
  (revenue = sum(amount) where `status='approved'`) — no separate ledger table.
  Aggregated in JS over the small purchases table (`lib/analytics/queries.ts`,
  deduped per request with React `cache`). Reads use the admin cookie client
  under RLS (admins SELECT purchases/exams/profiles).
- **Blog analytics** (`/admin/analytics/bloq`) come from `public.blog_views`
  (`supabase/analytics-schema.sql`). Views are recorded by a fire-and-forget
  beacon (`components/site/ViewBeacon.tsx` → `POST /api/view`, `runtime=nodejs`)
  so article pages stay static/ISR. The route stores a **salted SHA-256 hash of
  the IP** (never raw PII — `lib/analytics/ip.ts`) with a **service-role** write,
  de-duplicated per `(post, ip_hash, Baku day)` via a unique index. Heavy DISTINCT
  aggregates run in Postgres via SECURITY DEFINER RPCs (`blog_view_summary`,
  `blog_article_stats`, `blog_view_daily`) that re-check `is_admin()` internally.
  `blog_views` is **admin-read-only** RLS; no public read, no client write.
- **Timezone:** timestamps stay UTC (`timestamptz`); everything in the admin
  panel DISPLAYS in **Asia/Baku** via `formatBaku*` in `lib/format.ts`. Time
  windows (today/week/month/year) are bucketed in Baku (`lib/analytics/time.ts`
  fixed +4; the RPCs use the tz database). Never show UTC.
- **Charts are dependency-free** inline SVG/HTML (`components/admin/charts/*`:
  `StatCard`, `BarList`, `LineChart`, `DonutChart`, `ChartCard`) using the
  validated data-viz categorical palette (`palette.ts`) for the one categorical
  chart and `--primary` for single-series. The admin dashboard, sales, and blog
  pages compose these.

## Database

`supabase/schema.sql` (blog) + `supabase/exam-platform-schema.sql` (platform) +
`supabase/analytics-schema.sql` (blog_views + admin aggregate RPCs) are the
sources of truth (tables, RLS, storage buckets `article-images` public +
`receipts` private, SECURITY DEFINER `is_admin`/`has_exam_access`/
`get_exam_questions`/`blog_view_*`). The service-role key **cannot run DDL** —
apply schema by pasting SQL into the Supabase SQL editor. `supabase/reset-exams.sql`
wipes exam/sales data (keeps users/blog/settings). Domain types: `lib/types.ts`,
`lib/exams/types.ts`, `lib/student/types.ts`.

## Security (`lib/security/*`)

Shared primitives, imported by BOTH the client forms and the server actions so
the two rule sets can never drift. `password.ts` / `redirect.ts` are pure (safe
in client components); `rate-limit.ts` / `log.ts` / `request.ts` are `server-only`.

- **Auth flow is unchanged** (browser `signInWithPassword`, so the navbar still
  reacts via `onAuthStateChange`) but every attempt is bracketed by server
  actions in `lib/actions/account.ts`: `beginSignIn` → rate limit/lockout →
  Supabase → `reportSignIn` records the outcome. `beginSignUp` re-validates
  server-side and returns the CLEANED values the client then submits.
  **Password reset runs entirely server-side** (`requestPasswordReset`), so its
  rate limit can't be skipped; pages are `/sifre-sifirlama` + `/sifre-yenile`.
- **Rate limiting is in-process** (`rate-limit.ts`): per server instance, lost on
  cold start, and blind to requests that hit Supabase Auth directly. Supabase's
  own Auth limits + CAPTCHA are the real ceiling — see README §8.2. Lockouts are
  keyed per **(IP + account)** via `authKeys()` so nobody can lock a victim out.
- **Never reveal whether an account exists.** Sign-in, sign-up and reset all
  return one generic message. Don't "improve" the UX by branching on
  `error.message.includes("already")` — that's an enumeration oracle.
- **`safeRedirectPath()` for every `?redirect=`.** `startsWith("/") &&
  !startsWith("//")` is NOT sufficient — browsers read `/\host` as
  protocol-relative. Never build a Supabase `emailRedirectTo` from user input;
  use `safeAbsoluteRedirect(window.location.origin, …)`.
- **Client IP comes from `security/request.ts`**, which prefers proxy-set headers
  and reads XFF from the trusted (right) end. `x-forwarded-for` left-most is
  client-controlled — using it makes rate limits and view dedup forgeable.
  Tunable with `TRUSTED_PROXY_COUNT`. Route handlers that write must also call
  `isSameOrigin()` (Server Actions get that check for free; route handlers don't).
- **Logging**: `logSecurityEvent()` writes one JSON line, emails masked, IPs
  hashed. Never log passwords, tokens or cookies. The Edge middleware can't
  import it (`node:crypto`), so it logs inline without PII.
- **Headers/CSP live in `next.config.ts`.** `script-src` keeps `'unsafe-inline'`
  because a nonce would force every page dynamic and kill the static/ISR public
  site; everything else (`object-src`, `base-uri`, `form-action`,
  `frame-ancestors`, `connect-src`) is locked down. Because of that, HTML-escape
  anything interpolated into a `<script>` — use `jsonLdScript()` from
  `lib/json-ld.ts` for JSON-LD, never bare `JSON.stringify`.
- **Auth cookies are NOT HttpOnly** and cannot be, because sign-in happens in the
  browser (`AUTH_COOKIE_OPTIONS` in `lib/supabase/config.ts` explains the
  trade-off). The mitigation is the CSP + the renderer's output escaping.
- **Sensitive student actions require a verified email** (`verifiedUser()` in
  `lib/student/actions.ts`), and `supabase/security-hardening.sql` re-derives
  `purchases.amount` from the exam price in a trigger — the client never sets
  money. Apply that file; do NOT re-run `exam-platform-schema.sql` (it drops
  `purchases`/`exam_attempts`).

## Conventions

- **All user-facing text is Azerbaijani.** Keep it that way.
- Palette/fonts are fixed by the spec (light-only, no gradients/glassmorphism);
  tokens live in `app/globals.css` + `lib/site.ts` (site name/description/URL).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (see `.env.example`).
