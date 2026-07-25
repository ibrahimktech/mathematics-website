# Riyaziyyat Bloqu — Mathematics Blog

A modern academic-journal blog for publishing mathematics articles, Olympiad
solutions, proofs and theorems in **Azerbaijani**, with full **Markdown + LaTeX
(KaTeX)** support. A single administrator (the teacher) writes and publishes;
everyone else has read-only access.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui and
Supabase (Postgres + Auth + Storage).

---

## 1. Prerequisites

- Node.js 18.18+ (tested on Node 24)
- A free [Supabase](https://supabase.com) account

## 2. Install

```bash
npm install
```

## 3. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**. Pick a name and a
   strong database password, choose a region close to your readers.
2. Once it's ready, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (secret — server only)
3. **Disable public sign-ups** (there must be only one admin):
   **Authentication → Sign In / Providers** (or **Authentication → Settings**) →
   turn **OFF** “Allow new users to sign up”. Keep the **Email** provider enabled.
4. **Create the database schema:** open **SQL Editor → New query**, paste the
   entire contents of [`supabase/schema.sql`](supabase/schema.sql), and click
   **Run**. This creates the `posts` and `categories` tables, full-text search,
   Row-Level-Security policies, the `article-images` storage bucket, and seeds
   the 9 default categories. It is safe to re-run.
5. **Create the teacher's admin account:** **Authentication → Users → Add user**
   → enter the teacher's email + a password, and enable **Auto Confirm User**.
   (This is the only account that will ever exist.)

## 4. Configure environment

Copy the template and fill in the four values from step 3:

```bash
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS/Linux
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 5. Run

```bash
npm run dev
```

- Public site: <http://localhost:3000>
- Admin login: <http://localhost:3000/admin/login> (use the account from step 3.5)

> Ports 3000/3001 already taken? Run `npm run dev -- -p 4319` and adjust the URL.

## 6. Writing an article (for the teacher)

1. Log in → **Yeni Məqalə**.
2. Type a **Başlıq** (the link/slug is generated automatically).
3. Write in **LaTeX**. The **left** pane is your LaTeX source; the **right** pane
   shows a live typeset preview (like Overleaf, rendered straight to the page — no
   PDF). You can paste a whole document (`\documentclass … \end{document}`) or just
   write body commands. Supported: `\section`/`\subsection` (numbered),
   `\textbf`/`\emph`/`\texttt`, `\begin{equation}` (numbered) / `align` / `gather`,
   `\[ … \]` and `$ … $` math, `\begin{theorem}`/`lemma`/`proof` (with QED),
   `abstract`, `itemize`/`enumerate`, `tabular`, `figure`, `\ref`/`\eqref`/`\label`
   cross-references, and `\maketitle`. The toolbar inserts common commands for you.
4. **Drag & drop** or **paste** images into the editor (inserted as a `figure`);
   set a cover image, category and tags in the right panel.
5. **Yadda saxla** saves a draft; **Dərc et** publishes it live.

## 7. Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Add the four environment variables from `.env.local` in the Vercel project
   settings. Set `NEXT_PUBLIC_SITE_URL` to your real domain (e.g.
   `https://riyaziyyat.example.com`).
3. In Supabase **Authentication → URL Configuration**, add your production
   domain to the allowed Site URL / redirect URLs.

---

## Project structure

```
app/
  (public)/            Public reading site (Header + Footer shell)
    page.tsx           Homepage — latest articles + sidebar
    meqale/[slug]/     Article page (metadata, JSON-LD, prev/next, related, share)
    kateqoriya/[slug]/ Category listing
    axtar/             Search results
  admin/
    login/             Login (only public admin route)
    (dashboard)/       Protected shell: dashboard, articles, drafts,
                       published, categories, article editor
  sitemap.ts robots.ts rss.xml/   SEO feeds
components/
  site/                Public UI + shared MarkdownContent renderer
  admin/               Editor, ArticleForm, tables, category manager
  ui/                  shadcn/ui primitives
lib/
  supabase/            server / browser / public / middleware clients
  posts.ts categories.ts   Public data access (cookie-less, ISR-friendly)
  admin/queries.ts     Admin data access (authenticated)
  actions/             Server Actions (auth, posts, categories)
  markdown.tsx         Shared remark/rehype config (KaTeX, sanitize, highlight)
  slug.ts reading-time.ts format.ts site.ts
supabase/schema.sql    One-shot DB + RLS + storage + seed
```

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
```
