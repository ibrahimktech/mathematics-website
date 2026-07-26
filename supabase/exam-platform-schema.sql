-- =============================================================================
-- ANTG Riyaziyyat — EXAM PLATFORM schema v2
-- Admin-controlled exams + questions, manual bank-transfer purchases with
-- receipt review, enforced exam access, and payment settings.
-- =============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this WHOLE
-- file → Run. Idempotent and safe to re-run. Requires `supabase/schema.sql`
-- (the blog schema, which defines public.admins + public.is_admin()) to have
-- been applied first — this file re-declares those defensively just in case.
--
-- ⚠️  DESTRUCTIVE STEP: this file DROPS and recreates `public.purchases` and
--     `public.exam_attempts`. Those previously stored ONLY sample/mock data
--     keyed by hard-coded text exam ids that no longer exist, so nothing real
--     is lost. The blog (posts, categories, admins) is NOT touched.
--
-- SECURITY MODEL (read carefully):
--   • Admin = a row in public.admins. public.is_admin() (SECURITY DEFINER) is the
--     single source of truth, reused by every policy below. There is NO way to
--     become an admin from the app — the table has no write policies, so only the
--     SQL editor / service role can insert into it (see the very bottom).
--   • exams:            published rows are world-readable; drafts + all writes are
--                       admin-only.
--   • exam_questions:   ADMIN-ONLY at the table level. Students NEVER read this
--                       table directly (so correct answers can't leak). They get
--                       answer-free questions via public.get_exam_questions(), a
--                       SECURITY DEFINER function that first checks access.
--   • purchases:        a student may INSERT only their OWN, PENDING row and READ
--                       their own rows. They can never approve, deny, or edit a
--                       row — approve/deny happen server-side (service role) after
--                       an admin identity check. Admins may READ all.
--   • exam_access:      the enforced grant. NO student/anon write policies at all;
--                       rows are created server-side on approval. Students READ own.
--   • exam_attempts:    students READ own; all writes (create + graded score) are
--                       server-side (service role) so scores can't be forged.
--   • platform_settings:readable by any signed-in user (the payment page shows the
--                       bank details); writable by admins only. Holds ONLY
--                       display-facing payment info — NEVER secrets/keys.
--   • storage 'receipts' bucket is PRIVATE. A student may upload into and read
--     only their OWN folder; admins may read any receipt. Access is always via a
--     short-lived signed URL — there is no public URL.
-- =============================================================================

create extension if not exists pgcrypto;

-- ============================ Shared helpers (defensive) =====================
-- These already exist in schema.sql; re-declared with create-or-replace so this
-- migration is self-sufficient. Definitions are identical.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "Admins can read the admin list" on public.admins;
create policy "Admins can read the admin list"
  on public.admins for select to authenticated using (public.is_admin());

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

-- ============================ profiles (extend) =============================
-- profiles already exists (created in platform-schema.sql / on first sign-up).
-- Add the columns the admin purchase panel needs. All additive + idempotent.

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email          text;
alter table public.profiles add column if not exists first_name     text;
alter table public.profiles add column if not exists last_name      text;
alter table public.profiles add column if not exists student_number text;

-- Human-friendly, monotonic student numbers (e.g. shown as "#1001").
create sequence if not exists public.student_number_seq start 1001;

create unique index if not exists profiles_student_number_key
  on public.profiles (student_number);

alter table public.profiles enable row level security;

-- A student reads/updates ONLY their own profile...
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

-- ...but an ADMIN may read every profile (needed for the purchase panel: student
-- number, name, surname, email). Read-only; admins never edit student profiles.
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select to authenticated using (public.is_admin());

-- Auto-create + populate a profile on sign-up. Copies email, names and assigns a
-- student number. SECURITY DEFINER so it can write the profile from the auth hook.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_first text := new.raw_user_meta_data ->> 'first_name';
  v_last  text := new.raw_user_meta_data ->> 'last_name';
  v_full  text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(trim(concat_ws(' ', v_first, v_last)), '')
  );
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, student_number)
  values (
    new.id,
    new.email,
    v_full,
    v_first,
    v_last,
    nextval('public.student_number_seq')::text
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing profiles (email + student number) so pre-migration accounts
-- show up correctly in the admin panel.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and (p.email is null or p.email = '');

update public.profiles
   set student_number = nextval('public.student_number_seq')::text
 where student_number is null;

-- ============================ exams =========================================

create table if not exists public.exams (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,
  summary          text,
  description      text,
  category_slug    text,
  difficulty       text not null default 'intermediate'
                     check (difficulty in ('beginner','intermediate','advanced','olympiad')),
  price            numeric not null default 0 check (price >= 0),
  currency         text not null default 'AZN',
  duration_minutes int not null default 30 check (duration_minutes >= 0),
  covers           text[] not null default '{}',
  featured         boolean not null default false,
  status           text not null default 'draft'
                     check (status in ('draft','published','archived')),
  -- Denormalized count of questions, kept in sync by a trigger on exam_questions.
  -- Lets the PUBLIC catalogue show "N məsələ" by reading only this (published)
  -- row — it never needs access to the admin-only exam_questions table.
  question_count   int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists exams_status_idx on public.exams (status, created_at desc);
create index if not exists exams_slug_idx on public.exams (slug);
create index if not exists exams_category_idx on public.exams (category_slug);

drop trigger if exists exams_set_updated_at on public.exams;
create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

alter table public.exams enable row level security;

-- Published exams are world-readable (the public catalogue). Drafts/archived are
-- hidden from everyone but admins.
drop policy if exists "Public read published exams" on public.exams;
create policy "Public read published exams"
  on public.exams for select to anon, authenticated
  using (status = 'published');

drop policy if exists "Admins read all exams" on public.exams;
create policy "Admins read all exams"
  on public.exams for select to authenticated using (public.is_admin());

drop policy if exists "Admins insert exams" on public.exams;
create policy "Admins insert exams"
  on public.exams for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins update exams" on public.exams;
create policy "Admins update exams"
  on public.exams for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins delete exams" on public.exams;
create policy "Admins delete exams"
  on public.exams for delete to authenticated using (public.is_admin());

-- ============================ exam_questions ================================
-- ADMIN-ONLY at the table level. correct_index + explanation must never reach a
-- student, so there is deliberately NO anon/student policy here. Students receive
-- answer-free questions through public.get_exam_questions() (below).

create table if not exists public.exam_questions (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams(id) on delete cascade,
  position      int not null default 0,
  prompt        text not null,
  choices       jsonb not null default '[]'::jsonb,      -- array of LaTeX strings
  correct_index int check (correct_index >= 0),          -- 0-based; SECRET
  explanation   text,                                    -- shown only after grading
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists exam_questions_exam_idx
  on public.exam_questions (exam_id, position);

drop trigger if exists exam_questions_set_updated_at on public.exam_questions;
create trigger exam_questions_set_updated_at
  before update on public.exam_questions
  for each row execute function public.set_updated_at();

-- Keep exams.question_count in sync so the public catalogue never touches this
-- table. Recomputes for the affected exam on any insert/delete/move.
create or replace function public.sync_exam_question_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_exam uuid := coalesce(new.exam_id, old.exam_id);
begin
  update public.exams e
     set question_count = (
       select count(*) from public.exam_questions q where q.exam_id = v_exam
     )
   where e.id = v_exam;
  return null;
end;
$$;

drop trigger if exists exam_questions_count_sync on public.exam_questions;
create trigger exam_questions_count_sync
  after insert or delete or update of exam_id on public.exam_questions
  for each row execute function public.sync_exam_question_count();

alter table public.exam_questions enable row level security;

drop policy if exists "Admins read questions" on public.exam_questions;
create policy "Admins read questions"
  on public.exam_questions for select to authenticated using (public.is_admin());

drop policy if exists "Admins insert questions" on public.exam_questions;
create policy "Admins insert questions"
  on public.exam_questions for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins update questions" on public.exam_questions;
create policy "Admins update questions"
  on public.exam_questions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins delete questions" on public.exam_questions;
create policy "Admins delete questions"
  on public.exam_questions for delete to authenticated using (public.is_admin());

-- ============================ purchases (workflow) ==========================

drop table if exists public.purchases cascade;
create table public.purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  exam_id             uuid not null references public.exams(id) on delete cascade,
  amount              numeric not null default 0 check (amount >= 0),
  currency            text not null default 'AZN',
  status              text not null default 'pending'
                        check (status in ('pending','approved','denied')),
  receipt_path        text,
  receipt_unavailable boolean not null default false,
  admin_note          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid references auth.users(id)
);

create index if not exists purchases_user_idx on public.purchases (user_id);
create index if not exists purchases_status_idx on public.purchases (status, created_at desc);
create index if not exists purchases_exam_idx on public.purchases (exam_id);

-- At most ONE active (pending or approved) request per student+exam. A denied
-- request does NOT occupy the slot, so the student may submit a fresh request
-- later without a broken duplicate state. Also blocks double-submits (a second
-- pending insert races into a unique-violation, not a duplicate row).
drop index if exists purchases_one_active_per_exam;
create unique index purchases_one_active_per_exam
  on public.purchases (user_id, exam_id)
  where status in ('pending','approved');

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;

-- Students read their own purchases only.
drop policy if exists "Users read own purchases" on public.purchases;
create policy "Users read own purchases"
  on public.purchases for select to authenticated
  using ((select auth.uid()) = user_id);

-- Students may create ONLY their own, brand-new PENDING request. They cannot set
-- an approved/denied status, cannot pre-fill review fields, and cannot write a
-- row for someone else. (amount is set from the DB price by the server action;
-- even a forged amount here is harmless — the admin verifies the real transfer.)
drop policy if exists "Users create own pending purchase" on public.purchases;
create policy "Users create own pending purchase"
  on public.purchases for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
  );

-- NOTE: intentionally NO student UPDATE/DELETE policy. Approve/deny is done
-- server-side with the service role after an is_admin() check. Admins read all:
drop policy if exists "Admins read all purchases" on public.purchases;
create policy "Admins read all purchases"
  on public.purchases for select to authenticated using (public.is_admin());

-- ============================ exam_access (the grant) =======================

create table if not exists public.exam_access (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  exam_id     uuid not null references public.exams(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  granted_at  timestamptz not null default now(),
  unique (user_id, exam_id)                       -- one grant per student+exam
);

create index if not exists exam_access_user_idx on public.exam_access (user_id, exam_id);

alter table public.exam_access enable row level security;

-- Students read their own grants only. NO write policies at all — grants are made
-- server-side (service role) when an admin approves a purchase, so a student can
-- never grant themselves access.
drop policy if exists "Users read own access" on public.exam_access;
create policy "Users read own access"
  on public.exam_access for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins read all access" on public.exam_access;
create policy "Admins read all access"
  on public.exam_access for select to authenticated using (public.is_admin());

-- ============================ exam_attempts =================================

drop table if exists public.exam_attempts cascade;
create table public.exam_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  exam_id          uuid not null references public.exams(id) on delete cascade,
  status           text not null default 'in_progress'
                     check (status in ('in_progress','completed')),
  score            numeric,
  correct_count    int,
  total_count      int,
  answers          jsonb not null default '{}'::jsonb,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  duration_seconds int
);

create index if not exists attempts_user_idx on public.exam_attempts (user_id);
create index if not exists attempts_user_exam_idx on public.exam_attempts (user_id, exam_id);

alter table public.exam_attempts enable row level security;

-- Students read their own attempts/results. Writes (create + graded score) happen
-- server-side with the service role so scores can't be forged via the REST API.
drop policy if exists "Users read own attempts" on public.exam_attempts;
create policy "Users read own attempts"
  on public.exam_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

-- ============================ platform_settings =============================
-- Single row (id = 1). Holds ONLY display-facing payment info shown to signed-in
-- students on the payment page — never secrets, keys or passwords.

create table if not exists public.platform_settings (
  id             int primary key default 1 check (id = 1),
  bank_name      text,
  card_number    text,
  account_holder text,
  instructions   text,
  updated_at     timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

-- Any signed-in user may read the payment details (they need them to pay).
drop policy if exists "Authenticated read settings" on public.platform_settings;
create policy "Authenticated read settings"
  on public.platform_settings for select to authenticated using (true);

-- Only admins may change them.
drop policy if exists "Admins update settings" on public.platform_settings;
create policy "Admins update settings"
  on public.platform_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins insert settings" on public.platform_settings;
create policy "Admins insert settings"
  on public.platform_settings for insert to authenticated with check (public.is_admin());

-- ============================ Access-control functions ======================

-- Does the CURRENT user have access to take this exam? Enforces the exam being
-- PUBLISHED first, THEN (free OR an explicit grant). A price=0 draft/archived
-- exam is therefore never accessible. SECURITY DEFINER so it can read exam_access
-- regardless of table RLS; auth.uid() still scopes it to the caller.
create or replace function public.has_exam_access(p_exam_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.exams e
    where e.id = p_exam_id
      and e.status = 'published'
      and (
        e.price = 0
        or exists (
          select 1 from public.exam_access a
          where a.exam_id = p_exam_id
            and a.user_id = (select auth.uid())
        )
      )
  );
$$;
revoke all on function public.has_exam_access(uuid) from public;
grant execute on function public.has_exam_access(uuid) to authenticated;

-- Answer-free questions for a student who has access. Returns ZERO rows if the
-- exam isn't published or the caller lacks access. correct_index/explanation are
-- intentionally NOT selected, so the answer key can never reach the browser.
create or replace function public.get_exam_questions(p_exam_id uuid)
returns table (id uuid, "position" int, prompt text, choices jsonb)
language sql security definer set search_path = '' stable as $$
  select q.id, q.position, q.prompt, q.choices
  from public.exam_questions q
  where q.exam_id = p_exam_id
    and public.has_exam_access(p_exam_id)
  order by q.position asc, q.created_at asc;
$$;
revoke all on function public.get_exam_questions(uuid) from public;
grant execute on function public.get_exam_questions(uuid) to authenticated;

-- ============================ Storage: private receipts =====================
-- Private bucket with DB-level size (5 MB) + mime allow-list, on top of the
-- server-side magic-byte check in the upload action.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/jpeg','image/png','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A student may upload ONLY into their own folder: receipts/<uid>/<file>.
drop policy if exists "Users upload own receipts" on storage.objects;
create policy "Users upload own receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- A student may read (sign) only their OWN receipts; an admin may read ANY. This
-- is what makes admin "View receipt" work with the admin's own session (no
-- service role needed) — the signed-URL request passes this SELECT check.
drop policy if exists "Owner or admin read receipts" on storage.objects;
create policy "Owner or admin read receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

-- (No public/anon policy → receipts are never publicly reachable.)

-- ============================ FIRST ADMIN (do this once) ====================
-- After creating your account in Supabase → Authentication → Users, run ONE of:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict (user_id) do nothing;
--
-- There are no write policies on public.admins, so this is the ONLY way to grant
-- admin — a normal user can never promote themselves.
-- =============================================================================
