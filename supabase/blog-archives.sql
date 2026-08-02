-- =============================================================================
-- BLOG ARCHIVES — month buckets for the blog sidebar
-- =============================================================================
-- Run in Supabase → SQL Editor AFTER schema.sql. Idempotent + safe to re-run.
-- ADDITIVE: creates one function. No table, no column, no data is touched —
-- archives are DERIVED from public.posts, never stored.
--
-- WHY AN RPC: the sidebar needs one row per month, not every post. Grouping in
-- Postgres keeps the payload at ~one row per month regardless of how many
-- articles exist. No new index is needed: posts_status_published_at_idx
-- (status, published_at desc) from schema.sql already covers the scan.
--
-- SECURITY: SECURITY DEFINER, but it filters to status = 'published' itself, so
-- it can never surface a draft — it does not lean on RLS for that. It returns
-- only counts of already world-readable posts, hence the anon grant (the blog
-- sidebar is rendered by the cookie-less public client).
--
-- TIMEZONE: months are bucketed in Asia/Baku (tz database, DST-safe), the same
-- convention as the blog_view_* aggregates. Mirrored in lib/archives/period.ts.
-- =============================================================================

create or replace function public.blog_archive_counts()
returns table (period text, post_count int)
language sql
security definer
set search_path = ''
stable
as $$
  select
    to_char(timezone('Asia/Baku', p.published_at), 'YYYY-MM') as period,
    count(*)::int                                             as post_count
  from public.posts p
  where p.status = 'published'
    and p.published_at is not null
  group by 1
  order by 1 desc;   -- newest month first
$$;

revoke all on function public.blog_archive_counts() from public;
grant execute on function public.blog_archive_counts() to anon, authenticated;
