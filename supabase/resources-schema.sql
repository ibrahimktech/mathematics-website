-- =============================================================================
-- RESOURCES (PDF library) — additive patch on top of the existing schema
-- A shelf of PDF books/handouts that any SIGNED-IN student may read and
-- download, and only an allow-listed admin may upload, edit, replace or delete.
-- =============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this WHOLE
-- file → Run. Idempotent and SAFE TO RE-RUN.
--
-- ⚠️  DO **NOT** re-run `exam-platform-schema.sql` to get these changes: that
--     file DROPS and recreates `purchases` and `exam_attempts`, which would
--     destroy real sales and results. This patch is additive only — it creates
--     ONE new table and ONE new bucket, drops nothing, and deletes no rows.
--     Nothing here touches posts, exams, purchases, attempts, profiles or admins.
--
-- SECURITY MODEL (mirrors the rest of the platform — nothing new was invented):
--   • Admin = a row in public.admins, resolved by public.is_admin() (SECURITY
--     DEFINER, defined in schema.sql). Same single source of truth used by the
--     middleware, requireAdminPage() and every other policy in this project.
--   • public.resources : any AUTHENTICATED user may SELECT. Anonymous visitors
--     get nothing (no anon policy exists). INSERT/UPDATE/DELETE are admin-only,
--     so a student calling PostgREST directly with the anon key still cannot
--     add, edit or remove a resource — the UI is not the boundary, this is.
--   • storage bucket 'resources' is PRIVATE. Any authenticated user may read an
--     object (that is exactly the intended permission: every signed-in student
--     may read every book), which is what lets the app hand out short-lived
--     SIGNED URLs. Writes/deletes are admin-only. There is no public URL and no
--     anon policy, so an un-authenticated request for a file is refused even if
--     the path leaks.
--
-- WHY NO SERVICE ROLE ANYWHERE: every operation in this feature is performed by
-- a real, verified session (the student's for reads, the admin's for writes), so
-- RLS judges it. The service-role key is never needed and never used here.
-- =============================================================================

create extension if not exists pgcrypto;

-- ============================ Shared helpers (defensive) =====================
-- Both already exist (schema.sql). Re-declared with create-or-replace so this
-- file is self-sufficient if run against a fresh project. Definitions identical.

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================ resources =====================================
-- Postgres stores information ABOUT the file; Supabase Storage stores the PDF.
-- `file_path` is the object name inside the private 'resources' bucket
-- ("<year>/<uuid>.pdf") — never a URL, never a user-supplied filename.
-- `file_name` is the ORIGINAL filename, kept only for display and for the
-- Content-Disposition of a download; it is sanitised by the server action and
-- is never used to address storage.
--
-- Length limits are enforced here as well as in zod, so an oversized title
-- cannot be written by a direct PostgREST call that skips the server action.

create table if not exists public.resources (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  description   text          check (char_length(description) <= 2000),
  author        text          check (char_length(author) <= 200),
  -- Matches a blog category slug (public.categories.slug), exactly like
  -- exams.category_slug. Intentionally NOT a foreign key, for the same reason
  -- exams aren't: renaming/removing a category must never delete content.
  category_slug text          check (char_length(category_slug) <= 120),
  file_path     text not null check (char_length(file_path) <= 400),
  file_name     text not null check (char_length(file_name) between 1 and 200),
  file_size     bigint not null default 0 check (file_size >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One row per stored object. Without this, two rows could share a file_path and
-- deleting either would break the other (the object is removed once, but a
-- second row would keep pointing at it). Paths are random UUIDs so this can
-- never fire by accident — it exists to make the invariant real.
create unique index if not exists resources_file_path_key
  on public.resources (file_path);

-- Newest first is the library's default order.
create index if not exists resources_created_at_idx
  on public.resources (created_at desc);
create index if not exists resources_category_idx
  on public.resources (category_slug);

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

alter table public.resources enable row level security;

-- Any signed-in user may browse the library. No anon policy → anonymous
-- visitors read nothing, which is what makes /resurslar members-only at
-- the DATABASE level and not merely behind a redirect.
drop policy if exists "Authenticated read resources" on public.resources;
create policy "Authenticated read resources"
  on public.resources for select to authenticated using (true);

-- Writes are admin-only, whatever the caller (server action, stolen anon key +
-- a student's JWT, raw REST call).
drop policy if exists "Admins insert resources" on public.resources;
create policy "Admins insert resources"
  on public.resources for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins update resources" on public.resources;
create policy "Admins update resources"
  on public.resources for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins delete resources" on public.resources;
create policy "Admins delete resources"
  on public.resources for delete to authenticated using (public.is_admin());

-- ============================ Storage: private resources bucket =============
-- PRIVATE (public = false). Files are reachable only through a short-lived
-- signed URL minted for a verified session — there is no permanent public URL.
--
-- DB-level guards on top of the app's own checks: a hard 50 MB ceiling and an
-- application/pdf mime allow-list, so a non-PDF or an oversized upload is
-- refused by Storage itself even if the client-side validation is bypassed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources', 'resources', false, 52428800,      -- 50 MB
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Every signed-in user may read (and therefore sign) any object in this bucket.
-- That IS the intended permission — the library is open to all students — and it
-- is what lets the signed URL be created with the student's own session instead
-- of a service-role key.
drop policy if exists "Authenticated read resource files" on storage.objects;
create policy "Authenticated read resource files"
  on storage.objects for select to authenticated
  using (bucket_id = 'resources');

-- Uploading/replacing/removing a book is admin-only. The admin's browser uploads
-- straight to Storage with the anon key + their session (PDFs are far too large
-- to proxy through a Server Action), so THIS POLICY is the actual upload gate.
drop policy if exists "Admins upload resource files" on storage.objects;
create policy "Admins upload resource files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and public.is_admin());

drop policy if exists "Admins update resource files" on storage.objects;
create policy "Admins update resource files"
  on storage.objects for update to authenticated
  using (bucket_id = 'resources' and public.is_admin())
  with check (bucket_id = 'resources' and public.is_admin());

drop policy if exists "Admins delete resource files" on storage.objects;
create policy "Admins delete resource files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and public.is_admin());

-- (No anon policy on either the table or the bucket → anonymous access is denied
--  outright, so a leaked storage path is still useless without a session.)

-- ============================ verification ===================================
--   select count(*) from public.resources;                    -- new, empty
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'resources';            -- public = false
--   select policyname, cmd from pg_policies
--    where tablename = 'resources';                           -- 1 select + 3 admin
--
-- Full authorization matrix (anon blocked, student read-only, admin write):
--   node scripts/security-test.mjs
-- =============================================================================
