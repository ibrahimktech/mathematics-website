-- =============================================================================
-- RESET EXAM + SALES DATA — keeps the platform, wipes exam history.
-- =============================================================================
-- Run in Supabase → SQL Editor. Safe + idempotent (re-running just clears again).
--
-- DELETES: all exams, questions, answer choices/keys, purchases, exam access
--          grants, attempts, scores/progress.
-- KEEPS:   users, admins, blog posts, categories, auth, platform_settings,
--          blog analytics (blog_views), and all admin permissions.
--
-- FK layout means truncating `exams` alone would already cascade to
-- exam_questions / purchases / exam_access / exam_attempts; they are listed
-- explicitly for clarity. Nothing else references these tables, so there are no
-- orphaned rows afterwards. `blog_views → posts` is untouched.
--
-- ⚠️ RECEIPT FILES: uploaded receipts live in the private `receipts` storage
-- bucket. Supabase forbids deleting storage objects via SQL, so clear them
-- separately with ONE of:
--   • node scripts/clear-receipts.mjs        (uses the Storage API + service role)
--   • Dashboard → Storage → receipts → select all → Delete
-- (Leftover receipt files are harmless — RLS keeps them private — but this keeps
-- storage tidy after a full reset.)
-- =============================================================================

truncate table
  public.exam_attempts,
  public.exam_access,
  public.purchases,
  public.exam_questions,
  public.exams
restart identity cascade;

-- Verify (all should be 0):
--   select
--     (select count(*) from public.exams)          as exams,
--     (select count(*) from public.exam_questions) as questions,
--     (select count(*) from public.purchases)      as purchases,
--     (select count(*) from public.exam_access)    as access,
--     (select count(*) from public.exam_attempts)  as attempts;
