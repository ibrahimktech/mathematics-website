-- =============================================================================
-- RESET SALES DATA ONLY — wipes purchases + the access they granted.
-- =============================================================================
-- Run in Supabase → SQL Editor. Safe + idempotent (re-running just clears again).
--
-- Use this after test purchases have put fake revenue into
-- /admin/analytics/satis. Revenue is derived (sum of `amount` over approved
-- purchases — see lib/analytics/queries.ts), so removing the rows removes the
-- money; there is no separate ledger to fix up.
--
-- DELETES: every row in `purchases`, and the `exam_access` grants that were
--          created by approving one.
-- KEEPS:   exams, questions, user accounts + profiles, admins, blog posts,
--          categories, blog_views, platform_settings, and (by default) exam
--          attempts/scores. Nothing here touches auth.users.
--
-- This is the narrow counterpart to `reset-exams.sql`, which also TRUNCATES
-- `exams` + `exam_questions`. Use that one only for a full platform wipe.
--
-- ⚠️ RECEIPT FILES: uploaded receipts live in the private `receipts` storage
-- bucket and cannot be deleted from SQL. Afterwards run:
--     node scripts/clear-receipts.mjs
-- (Leftovers are harmless — storage RLS keeps them private — but the rows that
-- pointed at them are gone, so nothing can reach them again.)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- STEP 0 — look before you delete. Run this on its own first.
-- ---------------------------------------------------------------------------
select
  p.id,
  p.status,
  p.amount,
  p.currency,
  p.created_at,
  e.title  as exam,
  pr.email as student
from public.purchases p
left join public.exams e    on e.id = p.exam_id
left join public.profiles pr on pr.id = p.user_id
order by p.created_at desc;


-- ---------------------------------------------------------------------------
-- STEP 1 — drop the access grants that came from a purchase.
-- ---------------------------------------------------------------------------
-- `exam_access.purchase_id` is ON DELETE SET NULL, so deleting purchases first
-- would leave these grants behind as orphans and the test account would keep
-- free access to a paid exam. Delete them while the link still exists.
--
-- `purchase_id is not null` deliberately spares any grant made by hand from the
-- SQL editor (e.g. comping a student) — those have no purchase attached.
delete from public.exam_access
where purchase_id is not null;


-- ---------------------------------------------------------------------------
-- STEP 2 — drop the purchases themselves. This is what clears the revenue.
-- ---------------------------------------------------------------------------
delete from public.purchases;


-- ---------------------------------------------------------------------------
-- Verify — both should be 0, and the counts below should be unchanged.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.purchases)   as purchases_left,
  (select count(*) from public.exam_access) as access_left,
  (select count(*) from public.exams)       as exams_kept,
  (select count(*) from public.profiles)    as accounts_kept,
  (select count(*) from public.posts)       as posts_kept;


-- =============================================================================
-- OPTIONAL EXTRAS — not run above; uncomment only what you want.
-- =============================================================================

-- (a) Also clear test EXAM RESULTS. Attempts are not part of sales analytics
--     (no money), but a test run still shows up in /admin and in the student's
--     /panel/neticeler. Scores are stored on the attempt, so this is the only
--     way to remove them.
--
-- delete from public.exam_attempts;


-- (b) NARROWER: wipe only ONE test account's purchases instead of all of them.
--     Use this in place of STEP 1 + STEP 2 once you have real customers.
--
-- with victim as (
--   select id from public.profiles where email = 'test@example.com'
-- )
-- delete from public.exam_access
--  where purchase_id in (
--    select p.id from public.purchases p
--     where p.user_id in (select id from victim)
--  );
--
-- delete from public.purchases
--  where user_id in (select id from public.profiles where email = 'test@example.com');


-- (c) NARROWER STILL: keep approved sales, drop only leftover pending/denied
--     requests (these carry no revenue but do clutter /admin/purchases).
--
-- delete from public.purchases where status in ('pending', 'denied');
