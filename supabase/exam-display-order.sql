-- =============================================================================
-- EXAM DISPLAY ORDER — additive patch on top of the existing schema
-- Manual, teacher-controlled ordering of the exam catalogue.
-- =============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this WHOLE
-- file → Run. Idempotent and SAFE TO RE-RUN.
--
-- ⚠️  DO **NOT** re-run `exam-platform-schema.sql` to get these changes: that
--     file DROPS and recreates `purchases` and `exam_attempts`, which would
--     destroy real sales and results. This patch is additive only — it creates
--     no table, drops nothing, and deletes no rows.
--
-- WHY: exams were listed newest-first (`featured desc, created_at desc`), so the
-- catalogue mirrored the order the teacher happened to FINISH uploading them in.
-- Upload "11th-grade olympiad, 9th-grade RFO, 7th-grade RFM, 10th-grade
-- olympiad" and that is exactly what a student sees — which reads as random.
-- `display_order` replaces upload order with an order the teacher sets by hand
-- at /admin/exams/siralama.
--
-- WHAT THIS ADDS
--   1. `exams.display_order` — 1-based position in the catalogue, sorted ASC.
--      BACKFILLED in exactly today's public order (featured desc, created_at
--      desc, id), so the first page load after this migration is identical to
--      the last one before it. Nothing moves until the teacher drags something.
--   2. A BEFORE INSERT trigger giving a new exam `max(display_order) + 1`, so it
--      lands at the BOTTOM of the list. Being a trigger it covers every writer —
--      the server action, the service role, a raw PostgREST call, seed scripts.
--   3. A BEFORE UPDATE trigger that leaves `updated_at` alone when a write
--      touches display_order AND NOTHING ELSE, so reordering the catalogue does
--      not make every exam look freshly edited in the admin table.
--   4. `public.reorder_exams(uuid[])` — applies a whole new order in ONE
--      statement (atomic: no half-applied order is possible) after re-checking
--      `is_admin()` itself.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   • It does not touch `created_at`, `featured`, or any relationship. Purchases,
--     access grants, attempts and questions are untouched — ordering is display
--     only.
--   • DELETING AN EXAM LEAVES A GAP (…, 3, 5, 6, …) ON PURPOSE. Order is purely
--     relative, so `order by display_order` is unaffected by gaps, and the next
--     save from the reorder page renumbers everything to 1..N anyway. No delete
--     trigger, no extra writes, nothing that can drift out of sync.
--   • `display_order` is NOT unique. Two exams created in the same instant could
--     briefly share a position (harmless — `created_at` breaks the tie in every
--     query, and the next reorder renumbers). A unique index would instead turn
--     that race into a FAILED exam creation, which is strictly worse.
-- =============================================================================

-- ============================ the column ====================================

alter table public.exams
  add column if not exists display_order int;

comment on column public.exams.display_order is
  '1-based position in the catalogue (ORDER BY display_order ASC). Set by hand '
  'at /admin/exams/siralama through public.reorder_exams(); assigned max+1 on '
  'insert by the exams_set_display_order trigger. Gaps are legal and expected '
  'after a delete.';

-- Backfill in the order students see TODAY, so applying this migration changes
-- nothing on screen. `id` breaks ties so the numbering is deterministic.
--
-- Guarded two ways for re-runs: only NULL rows are numbered, and they start
-- after the current maximum, so a partially-applied state can never produce
-- duplicate positions.
with base as (
  select coalesce(max(display_order), 0) as offset_n from public.exams
),
numbered as (
  select
    id,
    row_number() over (order by featured desc, created_at desc, id) as n
  from public.exams
  where display_order is null
)
update public.exams e
   set display_order = base.offset_n + numbered.n
  from numbered, base
 where numbered.id = e.id;

-- The public catalogue reads `where status = 'published' order by display_order`,
-- which this composite index covers end to end.
create index if not exists exams_status_display_order_idx
  on public.exams (status, display_order);

-- ============================ new exams go last ==============================

create or replace function public.set_exam_display_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only fill a position the caller left empty. An explicit value (the restore
  -- script, a future import) is honoured as given.
  if new.display_order is null then
    select coalesce(max(display_order), 0) + 1
      into new.display_order
      from public.exams;
  end if;
  return new;
end;
$$;

drop trigger if exists exams_set_display_order on public.exams;
create trigger exams_set_display_order
  before insert on public.exams
  for each row execute function public.set_exam_display_order();

-- Now that every row is numbered and every new row gets a number, make the
-- column mandatory. Guarded so a partially-populated table can never abort the
-- whole migration.
do $$
begin
  if exists (select 1 from public.exams where display_order is null) then
    raise notice 'exams.display_order still has NULLs — leaving it nullable';
  else
    alter table public.exams alter column display_order set not null;
  end if;
end $$;

-- ============================ reordering is not editing ======================
-- `exams_set_updated_at` stamps now() on EVERY update, so without this a single
-- drag would mark all exams as freshly updated and the admin table's "Yenilənib"
-- column would lie. Undo the stamp when display_order is the only thing that
-- moved.

create or replace function public.exams_keep_updated_at_on_reorder()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Compare the two rows with display_order and updated_at (already stamped by
  -- the trigger that ran before this one) removed. If what remains is identical,
  -- the write only moved the exam in the list: it is not a content edit.
  --
  -- Compared as jsonb rather than as row values so the check stays correct no
  -- matter which columns the table gains later — nothing here has to be updated
  -- when a new exam field is added.
  if (to_jsonb(new) - 'display_order' - 'updated_at')
   = (to_jsonb(old) - 'display_order' - 'updated_at') then
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- Postgres fires BEFORE-row triggers in NAME order, and this one has to run
-- AFTER `exams_set_updated_at` to be able to undo it. The name is chosen for
-- that ordering ('u' sorts after 's'), it is not arbitrary.
drop trigger if exists exams_updated_at_keep_on_reorder on public.exams;
create trigger exams_updated_at_keep_on_reorder
  before update on public.exams
  for each row execute function public.exams_keep_updated_at_on_reorder();

-- ============================ the bulk reorder ===============================
-- Takes the complete new order as an array of exam ids, first to last, and
-- writes it with ONE `update … from unnest(…) with ordinality`. One statement =
-- one transaction: either the catalogue is fully renumbered or nothing changed.
-- No per-row round trips, and no window in which the order is half-applied.
--
-- SECURITY: SECURITY DEFINER (it must write rows the caller may only reach
-- through RLS), so it re-checks `public.is_admin()` ITSELF and raises otherwise.
-- That internal check is the real gate — the grant below is not: anon/authenticated
-- can attempt any public RPC regardless of what is revoked from `public`.

create or replace function public.reorder_exams(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total   int;
  v_given   int;
  v_distinct int;
  v_matched int;
  v_updated int;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_given := coalesce(array_length(p_ids, 1), 0);
  select count(*)           into v_total    from public.exams;
  select count(distinct id) into v_distinct from unnest(p_ids) as t(id);
  select count(*)           into v_matched  from public.exams e where e.id = any (p_ids);

  -- The submitted list must be a permutation of the WHOLE table. A partial or
  -- duplicated list would renumber some rows into positions others still hold,
  -- so refuse it outright instead of writing a broken order: the caller's page
  -- was loaded before an exam was added or deleted and must be reloaded.
  if v_given <> v_distinct or v_given <> v_total or v_matched <> v_total then
    raise exception 'stale exam order: % ids (% distinct, % matched) for % exams',
      v_given, v_distinct, v_matched, v_total
      using errcode = 'P0001';
  end if;

  update public.exams e
     set display_order = o.ord::int
    from unnest(p_ids) with ordinality as o(id, ord)
   where e.id = o.id
     and e.display_order is distinct from o.ord::int;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.reorder_exams(uuid[]) from public;
grant execute on function public.reorder_exams(uuid[]) to authenticated;

comment on function public.reorder_exams(uuid[]) is
  'Admin-only. Writes a complete new catalogue order (exam ids, first to last) '
  'in one atomic statement. Rejects any list that is not a permutation of every '
  'exam. Called by reorderExams() in lib/actions/exams.ts.';

-- ============================ verification ===================================
-- Every exam numbered, no duplicates, in the order students now see:
--
--   select display_order, status, title
--     from public.exams
--    order by display_order asc, created_at desc;
--
--   select display_order, count(*)
--     from public.exams
--    group by 1 having count(*) > 1;   -- expect zero rows
-- =============================================================================
