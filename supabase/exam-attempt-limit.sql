-- =============================================================================
-- EXAM ATTEMPT LIMIT — additive patch on top of the existing schema
-- Each student may attempt each exam at most TWO times.
-- =============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this WHOLE
-- file → Run. Idempotent and SAFE TO RE-RUN.
--
-- ⚠️  DO **NOT** re-run `exam-platform-schema.sql` to get these changes: that
--     file DROPS and recreates `purchases` and `exam_attempts`, which would
--     destroy real sales and results. This patch is additive only — it creates
--     no tables, drops no data, and deletes no rows.
--
-- WHAT THIS ADDS
--   1. `exam_attempts.attempt_number` — the 1-based ordinal of the attempt
--      within (student, exam). ASSIGNED BY A TRIGGER, never by the caller.
--   2. `public.max_exam_attempts()` — the single SQL source of truth for the
--      limit (mirrored by MAX_EXAM_ATTEMPTS in lib/student/status.ts, which is
--      display-only; THIS is the enforcing copy).
--   3. A BEFORE INSERT trigger that refuses attempt N+1. It fires for every
--      writer — the server action, the service role, a stolen anon key, psql —
--      so the limit cannot be bypassed by calling the API directly.
--   4. A unique index on (user_id, exam_id, attempt_number). This is what makes
--      the limit RACE-SAFE: two concurrent "Start exam" clicks both compute the
--      same ordinal and exactly one of them survives (the other gets 23505).
--      A row-counting check alone could not do that.
--
-- EXISTING DATA IS PRESERVED. Attempts were previously unlimited, so a student
-- may already have more than two rows for one exam; those are numbered 1..N and
-- kept. The trigger only blocks NEW attempts once the limit is reached, and a
-- CHECK constraint is deliberately NOT added so historical rows stay valid.
--
-- Starting an attempt CONSUMES it: an 'in_progress' row counts towards the
-- limit exactly like a 'completed' one, which is why the trigger counts all
-- rows regardless of status.
-- =============================================================================

-- ============================ the limit, in one place ========================

create or replace function public.max_exam_attempts()
returns int language sql immutable set search_path = '' as $$
  select 2;
$$;
revoke all on function public.max_exam_attempts() from public;
-- `service_role` is listed explicitly so the audit script can probe the function
-- to confirm this migration has been applied.
grant execute on function public.max_exam_attempts() to authenticated, service_role;

comment on function public.max_exam_attempts() is
  'Maximum attempts one student may make at one exam. Enforced by the '
  'exam_attempts_enforce_limit trigger; mirrored for display by '
  'MAX_EXAM_ATTEMPTS in lib/student/status.ts.';

-- ============================ attempt_number =================================

alter table public.exam_attempts
  add column if not exists attempt_number int;

comment on column public.exam_attempts.attempt_number is
  '1-based ordinal of this attempt within (user_id, exam_id). Assigned by the '
  'enforce_exam_attempt_limit() trigger — a client-supplied value is discarded.';

-- Backfill historical rows in chronological order. `id` breaks ties so the
-- numbering is deterministic if two rows share a started_at.
with numbered as (
  select
    id,
    row_number() over (
      partition by user_id, exam_id order by started_at, id
    ) as n
  from public.exam_attempts
)
update public.exam_attempts a
   set attempt_number = numbered.n
  from numbered
 where numbered.id = a.id
   and a.attempt_number is distinct from numbered.n;

-- The ordinal is unique per student+exam. Besides being an integrity rule, this
-- index is the concurrency guard described in the header.
create unique index if not exists exam_attempts_user_exam_number_key
  on public.exam_attempts (user_id, exam_id, attempt_number);

-- Now that every row is numbered, make the column mandatory. Guarded so a
-- partially-populated table can never abort the whole migration.
do $$
begin
  if exists (select 1 from public.exam_attempts where attempt_number is null) then
    raise notice 'exam_attempts.attempt_number still has NULLs — leaving it nullable';
  else
    alter table public.exam_attempts alter column attempt_number set not null;
  end if;
end $$;

-- ============================ the enforcement trigger ========================

create or replace function public.enforce_exam_attempt_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_used  int;
  v_limit int := public.max_exam_attempts();
begin
  -- Every existing attempt counts, in_progress included: clicking "Start"
  -- consumes an attempt immediately and it is never given back.
  select count(*) into v_used
    from public.exam_attempts a
   where a.user_id = new.user_id
     and a.exam_id = new.exam_id;

  if v_used >= v_limit then
    raise exception 'exam attempt limit reached (% of % used)', v_used, v_limit
      using errcode = 'P0001';
  end if;

  -- THE ORDINAL IS NOT CLIENT INPUT. Whatever arrived is discarded.
  new.attempt_number := v_used + 1;

  return new;
end;
$$;

drop trigger if exists exam_attempts_enforce_limit on public.exam_attempts;
create trigger exam_attempts_enforce_limit
  before insert on public.exam_attempts
  for each row execute function public.enforce_exam_attempt_limit();

-- ============================ one open attempt per exam ======================
-- Belt-and-braces: a student can have at most ONE unfinished attempt per exam,
-- so a resumed attempt is always unambiguous. Created inside an exception block
-- because pre-existing duplicates (only reachable through an old race) would
-- otherwise abort the migration; the limit trigger above does not depend on it.

do $$
begin
  begin
    create unique index if not exists exam_attempts_one_open_per_exam
      on public.exam_attempts (user_id, exam_id)
      where status = 'in_progress';
  exception when unique_violation then
    raise notice 'duplicate in_progress attempts exist — skipped exam_attempts_one_open_per_exam; finish or remove the duplicates, then re-run this file';
  end;
end $$;

-- ============================ verification ===================================
-- Attempts per student+exam, worst offenders first. Nothing here should exceed
-- max_exam_attempts() once this file has been applied:
--
--   select user_id, exam_id, count(*) as attempts, max(attempt_number) as last_no
--     from public.exam_attempts
--    group by user_id, exam_id
--    order by attempts desc
--    limit 20;
--
-- Then re-run the live authorization audit (it now covers the attempt limit):
--   node scripts/security-test.mjs
-- =============================================================================
