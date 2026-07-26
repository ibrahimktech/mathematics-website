-- =============================================================================
-- ANALYTICS schema — blog view tracking (privacy-preserving) + admin aggregates
-- =============================================================================
-- Run in Supabase → SQL Editor AFTER schema.sql + exam-platform-schema.sql.
-- Idempotent + safe to re-run. Additive: does NOT touch exams/blog/auth data.
--
-- PRIVACY: we never store a raw IP. The route handler (/api/view) stores a
-- salted SHA-256 HASH of the visitor IP, which is enough to (a) de-duplicate
-- refreshes and (b) count unique/returning visitors, without holding PII.
--
-- SECURITY: blog_views is ADMIN-READ-ONLY (RLS). There is no public/anon read
-- and no client write policy — inserts happen server-side with the service role.
-- The aggregate RPCs below are SECURITY DEFINER but each re-checks is_admin(),
-- so a normal user calling them directly is rejected.
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ blog_views --
-- One row per (article, visitor-hash, Baku calendar day). The unique constraint
-- makes repeated refreshes on the same day a no-op (ON CONFLICT DO NOTHING),
-- which is what keeps view counts honest.
create table if not exists public.blog_views (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  ip_hash    text not null,
  view_day   date not null,               -- Baku calendar day (dedup bucket)
  viewed_at  timestamptz not null default now(),
  unique (post_id, ip_hash, view_day)
);

create index if not exists blog_views_post_idx on public.blog_views (post_id);
create index if not exists blog_views_viewed_at_idx on public.blog_views (viewed_at desc);
create index if not exists blog_views_ip_idx on public.blog_views (ip_hash);

alter table public.blog_views enable row level security;

-- Admins only may read (IP hashes + traffic data are sensitive). No write policy
-- → inserts are service-role only (the /api/view route).
drop policy if exists "Admins read blog views" on public.blog_views;
create policy "Admins read blog views"
  on public.blog_views for select to authenticated using (public.is_admin());

-- ------------------------------------------------------- aggregate RPCs (admin) --
-- All time windows are computed in Asia/Baku via the tz database (DST-safe),
-- then compared against viewed_at (a UTC instant). Heavy DISTINCT work runs in
-- Postgres, not the app.

-- Whole-blog summary as one JSON object.
create or replace function public.blog_view_summary()
returns json language plpgsql security definer set search_path = '' stable as $$
declare
  baku      timestamp    := timezone('Asia/Baku', now());
  d_today   timestamptz  := timezone('Asia/Baku', date_trunc('day',   baku));
  d_week    timestamptz  := timezone('Asia/Baku', date_trunc('week',  baku));
  d_month   timestamptz  := timezone('Asia/Baku', date_trunc('month', baku));
  d_year    timestamptz  := timezone('Asia/Baku', date_trunc('year',  baku));
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return (
    with per_ip as (
      select ip_hash, count(distinct view_day) as days
      from public.blog_views
      group by ip_hash
    )
    select json_build_object(
      'total_views',        (select count(*) from public.blog_views),
      'unique_visitors',    (select count(*) from per_ip),
      'returning_visitors', (select count(*) from per_ip where days > 1),
      'views_today',        (select count(*) from public.blog_views where viewed_at >= d_today),
      'views_week',         (select count(*) from public.blog_views where viewed_at >= d_week),
      'views_month',        (select count(*) from public.blog_views where viewed_at >= d_month),
      'views_year',         (select count(*) from public.blog_views where viewed_at >= d_year)
    )
  );
end;
$$;
revoke all on function public.blog_view_summary() from public;
grant execute on function public.blog_view_summary() to authenticated;

-- Per-article aggregates (join to posts in the app for title/category/date).
create or replace function public.blog_article_stats()
returns table (
  post_id uuid,
  total_views int,
  unique_visitors int,
  returning_visitors int,
  last_viewed_at timestamptz
) language plpgsql security definer set search_path = '' stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    with per_ip as (
      select v.post_id, v.ip_hash,
             count(*) as views,
             count(distinct v.view_day) as days,
             max(v.viewed_at) as last_at
      from public.blog_views v
      group by v.post_id, v.ip_hash
    )
    select
      per_ip.post_id,
      sum(per_ip.views)::int,
      count(*)::int,
      count(*) filter (where per_ip.days > 1)::int,
      max(per_ip.last_at)
    from per_ip
    group by per_ip.post_id;
end;
$$;
revoke all on function public.blog_article_stats() from public;
grant execute on function public.blog_article_stats() to authenticated;

-- Daily views + unique visitors for the last p_days Baku days (for the charts).
create or replace function public.blog_view_daily(p_days int default 30)
returns table (view_date date, views int, visitors int)
language plpgsql security definer set search_path = '' stable as $$
declare
  cutoff timestamptz := timezone('Asia/Baku', date_trunc('day', timezone('Asia/Baku', now())))
                        - make_interval(days => greatest(p_days, 1) - 1);
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select (timezone('Asia/Baku', v.viewed_at))::date as view_date,
           count(*)::int as views,
           count(distinct v.ip_hash)::int as visitors
    from public.blog_views v
    where v.viewed_at >= cutoff
    group by 1
    order by 1;
end;
$$;
revoke all on function public.blog_view_daily(int) from public;
grant execute on function public.blog_view_daily(int) to authenticated;
