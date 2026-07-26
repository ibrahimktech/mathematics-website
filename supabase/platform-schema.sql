-- =============================================================================
-- ⚠️  SUPERSEDED — DO NOT RUN THIS FILE ANYMORE.
-- Replaced by `supabase/exam-platform-schema.sql`, which recreates profiles,
-- purchases and exam_attempts with the full admin/purchase-review workflow and a
-- newer handle_new_user() trigger. Running THIS file again would revert that
-- trigger and the purchases/attempts shape. Kept only for historical reference.
-- =============================================================================
-- ANTG Olimpiada — PLATFORM schema: student profiles, purchases, exam attempts
-- =============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. Idempotent and safe to re-run. Additive — does NOT touch the blog
-- schema in `schema.sql`.
--
-- SECURITY MODEL (read carefully):
--   • Every table below holds PRIVATE per-student data and has RLS enabled.
--   • Students may SELECT only their OWN rows (auth.uid() = user_id/id).
--   • profiles is user-writable (own row only) so students can edit their name.
--   • purchases & exam_attempts are READ-ONLY to students. All writes happen
--     server-side with the service-role key (never in the browser), with the
--     user_id taken from the verified session — so a student cannot self-grant a
--     purchase or forge a score via the REST API, and can never write to another
--     student's row. This is why there are deliberately no INSERT/UPDATE/DELETE
--     policies for `authenticated` on those two tables.
--
-- BEFORE STUDENTS CAN SIGN UP: Supabase → Authentication → Providers → Email →
-- "Enable Sign-ups" ON. (Optional: turn on "Confirm email"=off / autoconfirm for
-- instant login; otherwise students confirm via the emailed link — both work.)
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles --
-- One row per authenticated user (display name etc). Separate from the admin
-- allow-list in `public.admins`.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

-- Auto-create a profile on sign-up, copying the name from user_metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------- purchases --
-- A student's access grant for an exam. `exam_id` references the code-managed
-- exam catalogue (lib/exams) by its text id — the catalogue is public data, so
-- it is intentionally NOT a DB table.
create table if not exists public.purchases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  exam_id    text not null,
  created_at timestamptz not null default now(),
  unique (user_id, exam_id)
);

create index if not exists purchases_user_idx on public.purchases (user_id);

alter table public.purchases enable row level security;

-- Read-only for students: they see ONLY their own purchases. No write policies →
-- inserts/updates/deletes by `authenticated` are denied; grants are made
-- server-side with the service role (future: after a real payment webhook).
drop policy if exists "Users read own purchases" on public.purchases;
create policy "Users read own purchases"
  on public.purchases for select to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------- exam_attempts --
-- A student's attempt at an exam, including the graded result. Grading is
-- authoritative on the server; the score is written with the service role, so a
-- student cannot PATCH their own score.
create table if not exists public.exam_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  exam_id          text not null,
  status           text not null default 'in_progress'
                     check (status in ('in_progress','completed')),
  score            numeric,           -- percentage 0..100 (null until graded)
  correct_count    int,
  total_count      int,
  answers          jsonb not null default '{}'::jsonb,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  duration_seconds int
);

create index if not exists attempts_user_idx on public.exam_attempts (user_id);
create index if not exists attempts_user_exam_idx
  on public.exam_attempts (user_id, exam_id);

alter table public.exam_attempts enable row level security;

-- Read-only for students: they see ONLY their own attempts/results. No write
-- policies → all attempt creation + grading happens server-side with the
-- service role, with user_id taken from the verified session.
drop policy if exists "Users read own attempts" on public.exam_attempts;
create policy "Users read own attempts"
  on public.exam_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
