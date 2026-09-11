-- Report emails respect "Reports for this student".
--
-- Brief: design/donor-sponsorship/DESIGN_BRIEF.md (task "Report send: template,
-- language and exclusions"). Runs after 20260911180000. Safe to run twice.
--
-- 20260911090000 taught report_email_payload to leave out donors who turned off
-- emails altogether. 20260911140000 added a second, narrower switch: a donor
-- can keep funding a student and stop receiving that one student's reports.
-- Nothing read it, so the report still went. This re-creates the view with that
-- condition added. Same columns, same order, so `create or replace` is allowed.
--
-- Who is left out, and why, is worked out by the report-email function and
-- written to report_deliveries.reason, so the send dialog can name each one.

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
      and coalesce(sc.report_emails_enabled, true)
  ) as recipients
from public.term_updates t
  left join public.students s on s.id = t.student_id
  left join public.schools sch on sch.id = s.school_id;

comment on view public.report_email_payload is 'Everything one report email needs: every donor actively funding the student with report emails on (donor wide and for this student), and the language each asked for.';

grant select on public.report_email_payload to authenticated;
