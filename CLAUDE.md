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
  guards `/admin/*` (unauth → `/admin/login`, authed-but-not-admin → `/`),
  (2) the `(dashboard)` layout calls `requireAdminPage()` (`lib/admin/auth.ts`)
  as the authoritative per-request gate, (3) RLS in `supabase/schema.sql` gates
  every write (posts, categories, storage) and all draft reads on `is_admin()`.
  Actions in `lib/actions/*` re-check via `isAdmin(supabase)` and validate with
  zod; `signIn` rejects + signs out non-admins. Grant admin by inserting into
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

## Database

`supabase/schema.sql` is the single source of truth (tables, RLS, storage bucket
`article-images`, 9 seeded categories). The service-role key **cannot run DDL** —
schema changes are applied by pasting SQL into the Supabase SQL editor. Domain
types: `lib/types.ts`.

## Conventions

- **All user-facing text is Azerbaijani.** Keep it that way.
- Palette/fonts are fixed by the spec (light-only, no gradients/glassmorphism);
  tokens live in `app/globals.css` + `lib/site.ts` (site name/description/URL).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (see `.env.example`).
