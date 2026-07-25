-- =============================================================================
-- Mathematics Blog — database schema, RLS, storage and seed data
-- =============================================================================
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--   Safe to re-run (idempotent): policies are dropped-then-created, seeds use
--   ON CONFLICT DO NOTHING.
-- =============================================================================

create extension if not exists pgcrypto;

-- ============================ Tables =========================================

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  emoji       text,
  description text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.posts (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  slug                 text not null unique,
  cover_image_url      text,
  excerpt              text,
  content              text not null default '',
  category_id          uuid references public.categories(id) on delete set null,
  tags                 text[] not null default '{}',
  status               text not null default 'draft' check (status in ('draft','published')),
  published_at         timestamptz,
  reading_time_minutes int  not null default 1,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Full-text search vector, maintained by a trigger (see below). The 'simple'
  -- config is language-agnostic and fully UTF-8 safe (correct for Azerbaijani),
  -- with no stemming. A trigger is used instead of a GENERATED column because
  -- array_to_string() over `tags` is not IMMUTABLE, which generated columns
  -- require (Postgres raises 42P17 "generation expression is not immutable").
  search_vector tsvector
);

-- Allow-list of accounts permitted to use the admin panel. Being able to
-- authenticate is NOT enough — a user must have a row here to read drafts or
-- write anything. Managed only from the SQL editor / service role (see the
-- "grant admin" step at the bottom of this file); there are deliberately no
-- INSERT/UPDATE/DELETE RLS policies, so it cannot be modified via the anon key.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================ Indexes ========================================

create index if not exists posts_search_idx
  on public.posts using gin (search_vector);
create index if not exists posts_status_published_at_idx
  on public.posts (status, published_at desc);
create index if not exists posts_category_idx
  on public.posts (category_id);

-- ============================ updated_at trigger =============================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ============================ Full-text search trigger ======================
-- Weighted so title ranks highest, then excerpt/tags, then body.

create or replace function public.posts_update_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.content, '')), 'C');
  return new;
end;
$$;

drop trigger if exists posts_search_vector on public.posts;
create trigger posts_search_vector
  before insert or update on public.posts
  for each row execute function public.posts_update_search_vector();

-- ============================ Admin allow-list helper =======================
-- Single source of truth for "is the caller an admin?", reused by every RLS
-- policy below AND by the app (called as an RPC from middleware, the admin
-- layout and the server actions). SECURITY DEFINER so it can read public.admins
-- regardless of that table's own RLS (this also prevents policy recursion).
-- search_path is pinned to '' and every name is fully-qualified — the current
-- Supabase hardening guidance against search_path hijacking.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ============================ Row Level Security =============================

alter table public.categories enable row level security;
alter table public.posts      enable row level security;
alter table public.admins     enable row level security;

-- The allow-list itself: an admin may read it (used for admin management/UX);
-- everyone else sees nothing. No write policies exist on purpose, so the list
-- can only be changed with the service role / SQL editor.
drop policy if exists "Admins can read the admin list" on public.admins;
create policy "Admins can read the admin list"
  on public.admins for select
  to authenticated
  using (public.is_admin());

-- Public (anonymous) reads
drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories"
  on public.categories for select
  to anon, authenticated
  using (true);

-- Published posts are world-readable (anon AND signed-in non-admins alike).
drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
  on public.posts for select
  to anon, authenticated
  using (status = 'published');

-- Only allow-listed admins may read drafts / every post. Being authenticated is
-- no longer sufficient (this replaces the old "any authenticated user" rule).
drop policy if exists "Authenticated can read all posts" on public.posts;
drop policy if exists "Admins can read all posts" on public.posts;
create policy "Admins can read all posts"
  on public.posts for select to authenticated using (public.is_admin());

-- All writes are admin-only, enforced in the database regardless of how the
-- request arrives (server action, direct REST call with a stolen anon key, …).
drop policy if exists "Authenticated can insert posts" on public.posts;
drop policy if exists "Admins can insert posts" on public.posts;
create policy "Admins can insert posts"
  on public.posts for insert to authenticated with check (public.is_admin());

drop policy if exists "Authenticated can update posts" on public.posts;
drop policy if exists "Admins can update posts" on public.posts;
create policy "Admins can update posts"
  on public.posts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated can delete posts" on public.posts;
drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
  on public.posts for delete to authenticated using (public.is_admin());

drop policy if exists "Authenticated can insert categories" on public.categories;
drop policy if exists "Admins can insert categories" on public.categories;
create policy "Admins can insert categories"
  on public.categories for insert to authenticated with check (public.is_admin());

drop policy if exists "Authenticated can update categories" on public.categories;
drop policy if exists "Admins can update categories" on public.categories;
create policy "Admins can update categories"
  on public.categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated can delete categories" on public.categories;
drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can delete categories"
  on public.categories for delete to authenticated using (public.is_admin());

-- ============================ Storage (article images) ======================

insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read article images" on storage.objects;
create policy "Public read article images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'article-images');

-- Image writes are admin-only too — the editor uploads directly from the
-- browser with the anon key + admin session, so RLS is the real gate here.
drop policy if exists "Authenticated upload article images" on storage.objects;
drop policy if exists "Admins upload article images" on storage.objects;
create policy "Admins upload article images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'article-images' and public.is_admin());

drop policy if exists "Authenticated update article images" on storage.objects;
drop policy if exists "Admins update article images" on storage.objects;
create policy "Admins update article images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'article-images' and public.is_admin());

drop policy if exists "Authenticated delete article images" on storage.objects;
drop policy if exists "Admins delete article images" on storage.objects;
create policy "Admins delete article images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'article-images' and public.is_admin());

-- ============================ Seed: default categories ======================

insert into public.categories (name, slug, emoji, sort_order) values
  ('Həndəsə',              'hendese',             '📐', 1),
  ('Ədədlər Nəzəriyyəsi',  'ededler-nezeriyyesi', '🔢', 2),
  ('Cəbr',                 'cebr',                '➕', 3),
  ('Kombinatorika',        'kombinatorika',       '🧩', 4),
  ('IMO Problemləri',      'imo-problemleri',     '🏆', 5),
  ('Milli Olimpiada',      'milli-olimpiada',     '🥇', 6),
  ('Həllər',               'heller',              '📖', 7),
  ('Teoremlər',            'teoremler',           '💡', 8),
  ('Məqalələr',            'meqaleler',           '📝', 9)
on conflict (slug) do nothing;

-- ============================ Seed: the admin account =======================
-- ⚠️ REQUIRED ONE-TIME STEP — without a row here the teacher can sign in but is
-- redirected away from /admin (they are authenticated but not allow-listed).
--
-- 1. Create the teacher's account in Supabase → Authentication → Users
--    (public sign-ups stay DISABLED).
-- 2. Edit the email below to match, then run this block once. Re-running is safe.
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'teacher@example.com'
-- on conflict (user_id) do nothing;
