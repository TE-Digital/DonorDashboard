-- Account access for invited users (teachers first, any role after).
--
-- Two questions an admin asks about a person in a directory:
--   "can they sign in yet?" and "what have we already sent them?"
--
-- The first answer already exists, in auth.users (invited_at, confirmed_at,
-- last_sign_in_at, banned_until). Copying it into public.profiles would drift
-- the moment somebody accepts an invite, so it is read through a
-- security-definer function instead and never stored twice.
--
-- The second answer does not exist anywhere: Supabase does not record that an
-- admin pressed "resend". That is what the columns and the event table below
-- are for.

-- 1) What we sent, and when ------------------------------------------------

alter table public.profiles
  add column if not exists last_invite_at timestamp with time zone,
  add column if not exists invite_count   integer not null default 0;

comment on column public.profiles.last_invite_at is 'When an admin last sent this person an invite or password link. Not the same as auth.users.invited_at, which only records the first one.';
comment on column public.profiles.invite_count  is 'How many invite or password links an admin has sent. A high number with no sign-in means the email is not arriving.';

-- 2) The audit trail --------------------------------------------------------

create table if not exists public.user_access_events (
  id         uuid primary key default extensions.uuid_generate_v4(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null check (action in ('invite', 'resend_invite', 'send_reset', 'invite_link', 'revoke', 'restore')),
  -- 'email'     — Supabase mailed the link to the person
  -- 'clipboard' — an admin copied the link to send it another way (LINE, in person)
  channel    text check (channel in ('email', 'clipboard')),
  note       text,
  created_at timestamp with time zone not null default now()
);

comment on table public.user_access_events is 'Every access action an admin takes on somebody else''s account. Written by the admin-user-access edge function, never by the browser.';

create index if not exists user_access_events_user_id_idx    on public.user_access_events using btree (user_id, created_at desc);

alter table public.user_access_events enable row level security;

-- Admins read the trail. Nobody writes it from the browser: the edge function
-- holds the service role and is the only writer.
drop policy if exists "admins read access events" on public.user_access_events;
create policy "admins read access events"
  on public.user_access_events
  for select
  using (public.is_admin());

-- 3) Account state, read straight from auth.users ---------------------------
--
-- security definer because auth.users is not readable by `authenticated`. The
-- admin check is inside the function body, so a non-admin caller gets zero
-- rows rather than an error — the same shape a filtered list already has.

create or replace function public.admin_user_access_state()
returns table (
  user_id          uuid,
  invited_at       timestamp with time zone,
  confirmed_at     timestamp with time zone,
  last_sign_in_at  timestamp with time zone,
  banned_until     timestamp with time zone,
  last_invite_at   timestamp with time zone,
  invite_count     integer
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.invited_at,
    u.confirmed_at,
    u.last_sign_in_at,
    u.banned_until,
    p.last_invite_at,
    p.invite_count
  from auth.users u
  join public.profiles p on p.id = u.id
  where public.is_admin();
$$;

comment on function public.admin_user_access_state() is 'Sign-in state for every user with a profile. Admin only; returns no rows to anyone else.';

revoke all on function public.admin_user_access_state() from public, anon;
grant execute on function public.admin_user_access_state() to authenticated;
