-- =============================================================================
-- RESTORE exams — reconstructed after an accidental `reset-exams.sql` run.
-- =============================================================================
-- Source: Next.js fetch cache (.next/cache/fetch-cache) — the cached Supabase
-- REST responses for the PUBLIC exam catalogue, which contain every column of
-- `exams`. Recovered on 2026-07-30.
--
-- RESTORES: the 7 published exam rows, with their ORIGINAL ids, so existing
--           /imtahanlar/<slug> URLs and any external links keep working.
-- DOES NOT RESTORE: exam_questions, purchases, exam_access, exam_attempts —
--           those are never public, so they were never in the cache. Only a
--           Supabase backup / PITR can bring those back.
--
-- question_count is set to 0 on purpose: the questions are gone, and the trigger
-- on exam_questions will maintain the real count once questions are re-entered.
--
-- Idempotent: re-running updates the same rows instead of duplicating them.
-- Run in Supabase → SQL Editor.
-- =============================================================================

insert into public.exams (
  id, title, slug, summary, description,
  category_slug, difficulty, price, currency, duration_minutes,
  covers, featured, status, question_count, created_at, updated_at
) values
  ('d5ae942f-a909-417c-9054-4a8c01cdded8'::uuid, 'Olimpiada Sınaq', 'olimpiada-sinaq', null, 'Imtahan olimpiada movzulari haqqinda suallardir',
   'cebr', 'intermediate', 10, 'AZN', 30,
   '{}', false, 'published', 0, '2026-07-26T12:07:06.35435+00:00'::timestamptz, '2026-07-26T12:11:41.312077+00:00'::timestamptz),
  ('4c3cbf2a-3a2f-43de-aefc-2f5a14f9cae5'::uuid, 'Imtahan', 'imtahan', null, null,
   null, 'intermediate', 10, 'AZN', 30,
   '{}', false, 'published', 0, '2026-07-26T12:20:34.227457+00:00'::timestamptz, '2026-07-26T12:21:43.115344+00:00'::timestamptz),
  ('556c577b-4f21-4a57-9efa-7f20922f6f02'::uuid, 'Olimpiada sinaqi giris', 'olimpiada-sinaqi-giris', null, null,
   'hendese', 'olympiad', 90, 'AZN', 800,
   '{}', false, 'published', 0, '2026-07-26T13:44:47.987077+00:00'::timestamptz, '2026-07-26T13:46:30.993968+00:00'::timestamptz),
  ('905902b6-7079-4d2b-9a35-32e6a8f597bf'::uuid, '7-ci Sinif RFM Qəbul Sınağı', '7-ci-sinif-rfm-sinaq-1', '7-ci Siniflər üçün dərslərimizə qəbul sınağıdır. Dərslərimə qoşula bilmək üçün bu sınaqda 60%-dan yuxarı nəticə göstərmək zəruridir.', 'İmtahan əsasən olimpiada tipli suallardan ibarətdir. Baxmayaraq ki,7-ci sinifə yeni başlayan şagirdlər üçündür tələb olunan istedadlı eyni zamanda biliyini artırmış şagirdlərə şamildir.',
   null, 'olympiad', 0, 'AZN', 90,
   array['Cəbr','Həndəsə','Ədədlər nəzəriyyəsi','Kombinatorika']::text[], true, 'published', 0, '2026-07-27T15:28:17.107626+00:00'::timestamptz, '2026-07-28T23:22:14.448948+00:00'::timestamptz),
  ('c5b2c652-dbb6-4a06-bd25-af84552f90bd'::uuid, '8-ci Sinif RFO Qəbul Sınağı', '8-ci-sinif-rfo-qebul-sinagi', null, null,
   null, 'olympiad', 0, 'AZN', 120,
   '{}', true, 'published', 0, '2026-07-27T15:39:36.661507+00:00'::timestamptz, '2026-07-29T12:25:43.883696+00:00'::timestamptz),
  ('c3a5ea77-fd89-494c-a265-ef01c1fb755d'::uuid, '9-cu Sinif RFO Qəbul Sınağı', '9-cu-sinif-rfo-qebul-sinagi', null, null,
   null, 'olympiad', 5, 'AZN', 90,
   '{}', false, 'published', 0, '2026-07-27T15:42:31.781785+00:00'::timestamptz, '2026-07-27T16:31:31.546297+00:00'::timestamptz),
  ('475544ee-ec2b-447e-9dc8-a0fb46f10ea0'::uuid, '10-11-ci Siniflər Qəbul Sınağı', '10-11-ci-sinifler-qebul-sinagi', null, null,
   null, 'olympiad', 5, 'AZN', 90,
   '{}', false, 'published', 0, '2026-07-27T16:26:54.287035+00:00'::timestamptz, '2026-07-27T16:31:05.637333+00:00'::timestamptz)
on conflict (id) do update set
  title            = excluded.title,
  slug             = excluded.slug,
  summary          = excluded.summary,
  description      = excluded.description,
  category_slug    = excluded.category_slug,
  difficulty       = excluded.difficulty,
  price            = excluded.price,
  currency         = excluded.currency,
  duration_minutes = excluded.duration_minutes,
  covers           = excluded.covers,
  featured         = excluded.featured,
  status           = excluded.status,
  created_at       = excluded.created_at;

-- Verify:
--   select slug, title, price, status, question_count from public.exams order by created_at;
