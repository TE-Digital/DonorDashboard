-- Report emails respect "Wants email updates".
--
-- donors.wants_email_updates has been on both donor forms since the beginning,
-- labelled "Wants email updates", and is saved every time. Nothing read it:
-- report_email_payload listed every donor with an active scholarship, so a
-- donor who unticked it still received every report. This re-creates the view
-- with that one condition added. A null -- a donor saved before anyone set the
-- field -- counts as yes, because nobody asked for those emails to stop.
--
-- Runs after 20260831090000_bilingual_and_email, which created the view. It is
-- a new file rather than an edit to that one so it applies whether or not that
-- migration has already run somewhere. Same columns, same order, so
-- `create or replace` is allowed.

create or replace view public.report_email_payload
with (security_invoker = true)
as
select
  t.id as report_id,
  t.student_id,
  s.name as student_name,
  s.name_th as student_name_th,
  s.grade_level,
  s.profile_photo_path,
  sch.name as school_name,
  sch.name_th as school_name_th,
  t.report_date,
  t.covers_start,
  t.covers_end,
  t.donor_comment_en,
  t.donor_comment_th,
  t.grade_text_en,
  t.grade_text_th,
  t.attachments,
  t.status,
  t.sent_at,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'donor_id', d.id,
          'name', d.name,
          'email', d.contact ->> 'email',
          'language', coalesce(d.preferred_language, 'en')
        )
      ),
      '[]'::jsonb
    )
    from public.scholarships sc
      join public.donors d on d.id = sc.donor_id
    where sc.student_id = t.student_id
      and sc.status = 'active'
      and sc.ended_at is null
      and coalesce(d.wants_email_updates, true)
  ) as recipients
from public.term_updates t
  left join public.students s on s.id = t.student_id
  left join public.schools sch on sch.id = s.school_id;

comment on view public.report_email_payload is 'Everything one report email needs, including every funding donor who has report emails on, and the language each of them asked for.';

grant select on public.report_email_payload to authenticated;
