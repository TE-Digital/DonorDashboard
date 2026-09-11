# Staging runbook: donor records (tasks 1.1–1.3)

Scripts in this folder are **never run by `db push`**. Each one is run by hand, in order, on **staging first**.

## 1.1 Stand up staging

1. Restore a copy of production into a staging Supabase project. Never run the steps below against production first.
2. Apply the migrations in order:
   `20260828120000` lifecycle → `20260830090000` funding → `20260831090000` bilingual → `20260831100000` school_location → `20260911090000` report recipients → `20260911100000` donor records → `20260911110000` award copy plan.
3. Run the probe query in `docs/BACKEND_IMPLEMENTATION.md`. Every flag should read `true`.
4. Compare `donors`, `scholarships` and `scholarship_awards` with `full_schema.sql`. That dump is dated **14 June 2026** and may be stale. If a column the migrations rely on is missing or differently named, stop and fix the migration before going further.

## 1.2 Check the donor records migration

```sql
-- Every donor has a type; no country breaks the ISO rule.
select donor_type, count(*) from public.donors group by 1;

-- No scholarship still says 'inactive'.
select status, count(*) from public.scholarships group by 1;

-- Phones: what was normalised, and what is left for the "Phone needs fixing" list.
select contact ->> 'phone' as phone, count(*)
from public.donors
where nullif(btrim(contact ->> 'phone'), '') is not null and contact ->> 'phone' !~ '^\+[1-9][0-9]{7,14}$'
group by 1 order by 2 desc;

-- The balance view shows rows to an admin and none to a teacher or another donor.
select count(*) from public.donor_balance;
```

## 1.3 Copy old awards (preview, then write)

1. **Preview.** Read the plan; nothing is written:
   ```sql
   select action, reason, count(*) from public.scholarship_award_copy_plan group by 1, 2 order by 1, 2;
   select * from public.scholarship_award_copy_plan
   where action = 'flag' or (creates_payment and donor_already_has_payments);
   ```
   A person checks every `flag` row, and every donor who already has payments recorded by hand, since those payments may be the same money an award marks as paid. **Cancelled awards are always flagged, never copied automatically.** `donor_balance` counts an ended scholarship's whole `amount_thb` as used, and nobody knows how much of a cancelled award was. So a person handles each one by hand, in two steps: enter the award as a scholarship (the Assign students drawer, from the donor), then **End** it from the student's Donors tab with the date it was really cancelled. `end_sponsorship()` (`20260911150000_sponsorship_actions.sql`, admin-only) takes a past end date, trims `amount_thb` to the money actually used, and writes a `scholarship_releases` row for the remainder, so the donor's balance comes out right without anyone working out the arithmetic.
2. **Write.** Run `copy_scholarship_awards.sql`. It runs as one transaction and rolls back on its own if anything is left uncopied, or if paid awards and payments don't match.
3. **Done when** *awards in = created + skipped + flagged + already copied*, and a sample of migrated donors show a zero or truthful balance on their overview, not a negative one.

Only after this has run **in production** can task 1.13 retire the old donor edit page.
