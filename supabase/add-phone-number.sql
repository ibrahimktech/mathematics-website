-- =============================================================================
-- PHONE NUMBER ON PROFILES — additive patch on top of the existing schema
-- Sign-up now collects a required Azerbaijani number (+994 followed by 9 digits).
-- =============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this WHOLE
-- file → Run, once. Idempotent and SAFE TO RE-RUN.
--
-- ⚠️  DO **NOT** re-run `exam-platform-schema.sql` to get this change: that file
--     DROPS and recreates `purchases` and `exam_attempts`, which would destroy
--     real sales and results. This patch is additive only — it adds ONE nullable
--     column and refreshes ONE trigger function; it creates no tables, drops
--     nothing and deletes no rows.
--
-- WHAT THIS ADDS
--   1. `profiles.phone_number` — ORDINARY PROFILE DATA, stored exactly like
--      first_name / last_name. It is deliberately NOT Supabase's built-in
--      `auth.users.phone`: that column belongs to phone-based auth (SMS OTP),
--      which this project does not use. Sign-in stays email + password only.
--   2. `public.handle_new_user()` re-created with the number carried across from
--      `raw_user_meta_data ->> 'phone_number'` — written by the browser's
--      `supabase.auth.signUp({ options: { data: … } })` call in
--      components/account/SignUpForm.tsx — plus the unchanged trigger that runs
--      it. The rest of the function body is identical to the copy in
--      exam-platform-schema.sql.
--
-- EXISTING DATA IS PRESERVED. The column is nullable, so accounts created before
-- this migration simply have no number and show "—" in the admin users list.
-- RLS is untouched: `profiles` already limits reads to the owner and to admins.
-- =============================================================================

alter table public.profiles add column if not exists phone_number text;

-- Auto-create + populate a profile on sign-up. Copies email, names, phone and
-- assigns a student number. SECURITY DEFINER so it can write the profile from
-- the auth hook.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_first text := new.raw_user_meta_data ->> 'first_name';
  v_last  text := new.raw_user_meta_data ->> 'last_name';
  v_phone text := new.raw_user_meta_data ->> 'phone_number';
  v_full  text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(trim(concat_ws(' ', v_first, v_last)), '')
  );
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, phone_number, student_number)
  values (
    new.id,
    new.email,
    v_full,
    v_first,
    v_last,
    v_phone,
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
