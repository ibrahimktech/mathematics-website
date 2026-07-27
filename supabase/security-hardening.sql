-- =============================================================================
-- SECURITY HARDENING — additive patch on top of the existing schema
-- =============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this WHOLE
-- file → Run. Idempotent and SAFE TO RE-RUN.
--
-- ⚠️  DO **NOT** re-run `exam-platform-schema.sql` to get these changes: that
--     file DROPS and recreates `purchases` and `exam_attempts`, which would
--     destroy real sales and results. This patch is additive only — it creates
--     no tables, drops nothing, and deletes no rows.
--
-- WHAT THIS FIXES
--   1. A student could INSERT a purchase row with a forged `amount`/`currency`,
--      or against a draft/free exam, by calling PostgREST directly instead of
--      using the app. The RLS policy checked WHO and the STATUS, but never the
--      MONEY. An approved forged row silently corrupts the revenue figures in
--      /admin/analytics/satis.
--   2. A student could point `receipt_path` at ANOTHER student's folder. They
--      still could not read that file themselves (storage RLS), but an admin
--      opening the receipt would be shown someone else's document attributed to
--      the wrong buyer — an integrity and privacy problem during review.
--
-- Both are closed with a BEFORE INSERT trigger, so the rule holds no matter how
-- the row arrives: server action, REST call with a stolen anon key, or SQL.
-- The application already sets these fields correctly, so behaviour is unchanged
-- for every legitimate purchase.
-- =============================================================================

-- ============================ purchases: authoritative amount ================

create or replace function public.enforce_purchase_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_price    numeric;
  v_currency text;
  v_status   text;
begin
  -- Service-role callers (the admin approve/deny path) bypass RLS but still run
  -- triggers; they legitimately do not need this re-derivation, and they only
  -- ever UPDATE. This trigger is INSERT-only, so nothing else needs excluding.

  select e.price, e.currency, e.status
    into v_price, v_currency, v_status
    from public.exams e
   where e.id = new.exam_id;

  if v_price is null then
    raise exception 'unknown exam';
  end if;

  -- A draft or archived exam can never be purchased, mirroring has_exam_access().
  if v_status <> 'published' then
    raise exception 'exam is not available';
  end if;

  -- Free exams need no purchase at all; allowing one would create a bogus
  -- pending row and an approval path to an "access grant" nobody paid for.
  if v_price <= 0 then
    raise exception 'exam is free';
  end if;

  -- THE MONEY IS NOT CLIENT INPUT. Whatever was submitted is discarded and the
  -- catalogue price is written instead.
  new.amount   := v_price;
  new.currency := v_currency;

  -- A receipt may only ever live in the submitting user's own folder, which is
  -- the same rule the storage INSERT policy enforces for the upload itself.
  if new.receipt_path is not null
     and new.receipt_path not like (new.user_id::text || '/%') then
    raise exception 'receipt path must be inside the owner folder';
  end if;

  return new;
end;
$$;

drop trigger if exists purchases_enforce_integrity on public.purchases;
create trigger purchases_enforce_integrity
  before insert on public.purchases
  for each row execute function public.enforce_purchase_integrity();

-- ============================ least privilege on helpers =====================
-- is_admin() only ever returns false for an anonymous caller, but there is no
-- reason for anon to be able to call it at all. Keep it to signed-in users.
revoke execute on function public.is_admin() from anon;

-- ============================ OPTIONAL: require a verified e-mail ============
-- The application already refuses to create purchases or start attempts for an
-- unverified account (`verifiedUser()` in lib/student/actions.ts). Uncommenting
-- the block below moves that rule into the database as well.
--
-- ⚠️  ONLY enable this if "Confirm email" is ON in
--     Supabase → Authentication → Sign In / Providers. If confirmation is off,
--     `email_confirmed_at` is null for everyone and this would revoke access
--     for every existing student at once.
--
-- create or replace function public.has_exam_access(p_exam_id uuid)
-- returns boolean language sql security definer set search_path = '' stable as $$
--   select exists (
--     select 1
--     from public.exams e
--     join auth.users u on u.id = (select auth.uid())
--     where e.id = p_exam_id
--       and e.status = 'published'
--       and u.email_confirmed_at is not null
--       and (
--         e.price = 0
--         or exists (
--           select 1 from public.exam_access a
--           where a.exam_id = p_exam_id
--             and a.user_id = (select auth.uid())
--         )
--       )
--   );
-- $$;
-- revoke all on function public.has_exam_access(uuid) from public;
-- grant execute on function public.has_exam_access(uuid) to authenticated;

-- ============================ verification ===================================
-- After running this file, re-run the live authorization audit:
--   node scripts/security-test.mjs
-- =============================================================================
