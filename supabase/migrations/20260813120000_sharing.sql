-- Sharing a child with another person.
--
-- Two roles, and the asymmetry between them carries the whole design:
--
--   * "Delar ansvaret" — co-manage. Stored as the existing 'owner' role, so a
--     second guardian is genuinely equal to the first: same rights, same
--     screens, no primary account. Permanent — no policy and no function here
--     removes an 'owner' membership.
--   * "Kan se" — view-only, the existing 'viewer' role. Revocable by any
--     co-manager at any time.
--
-- Permanence attaches to the role, not to the link. Sharing is open to whoever
-- holds the link, so a permanent role behind a forwardable link would hand a
-- stranger unrevocable access to a child's health data. Splitting it by role
-- keeps the custody stance — two guardians cannot shut each other out — while
-- leaving view-only access removable.
--
-- Everything about an invite is decided before the link exists and is read from
-- the invite row on the way in. The client sends a token and nothing else; it
-- never sends a role.
--
-- Not settled here, and both are product decisions rather than schema ones:
--   * whether a co-manager can remove *themselves* (leaving). Nothing here
--     allows it; adding it later is one delete policy.
--   * whether view-only access should expire on its own. It does not; adding it
--     later is a nullable column on child_members plus a clause in
--     has_child_access.

-- ----------------------------------------------------------------- profiles --

-- Sharing needs names. auth.users is not readable by application roles, and a
-- household screen that says "okänd användare" next to a person's access is
-- worse than useless, so each user gets a row here with a display name derived
-- from their email. There is no screen for editing it yet.
create or replace function public.display_name_from_email(p_email text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      initcap(regexp_replace(split_part(btrim(p_email), '@', 1), '[._+-]+', ' ', 'g')),
      ''),
    'Någon');
$$;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text        not null,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- Own row only. Other people's names reach the app through the functions below,
-- which check membership first — there is no way to enumerate users.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, public.display_name_from_email(new.email))
  on conflict (id) do update
    set email        = excluded.email,
        display_name = excluded.display_name;
  return new;
end;
$$;

create trigger users_sync_profile
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_from_auth();

insert into public.profiles (id, email, display_name)
select id, email, public.display_name_from_email(email) from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------ attribution --

-- "lagt in av Erik" under a measurement in a shared child. Stamped by the
-- database rather than by the caller: a client that sends someone else's id
-- would otherwise get to write it, and an update must not be able to rewrite
-- history either.
create or replace function public.stamp_created_by()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = (select auth.uid());
  else
    new.created_by = old.created_by;
  end if;
  return new;
end;
$$;

create trigger measurements_stamp_created_by
  before insert or update on public.measurements
  for each row execute function public.stamp_created_by();

-- ------------------------------------------------------------- membership --

-- Co-manage. The name says "manage" rather than "own" because there is no
-- single owner: every 'owner' row on a child is equal to every other.
create or replace function public.has_child_manage(target_child uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.child_members m
    where m.child_id = target_child
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

create or replace function public.child_manager_count(target_child uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.child_members m
  where m.child_id = target_child
    and m.role = 'owner';
$$;

revoke all on function public.has_child_manage(uuid) from public;
revoke all on function public.child_manager_count(uuid) from public;
grant execute on function public.has_child_manage(uuid) to authenticated;
grant execute on function public.child_manager_count(uuid) to authenticated;

-- Everyone with access to a child sees who else has access. This is the access
-- screen's own data, and a household that cannot see its own membership cannot
-- be told who can read the child's measurements.
drop policy child_members_select_own on public.child_members;
create policy child_members_select_shared on public.child_members
  for select to authenticated
  using (public.has_child_access(child_id));

-- Revoking view-only access. A co-manager row matches no policy here and so
-- cannot be deleted by anyone, which is the permanence rule stated as SQL
-- rather than as a missing button.
create policy child_members_delete_viewer on public.child_members
  for delete to authenticated
  using (role = 'viewer' and public.has_child_manage(child_id));

-- Deleting the child itself is the back door around permanence: it would remove
-- the measurements for the other guardian as well, which is exactly what
-- "neither can shut the other out" forbids. Allowed only while the caller is
-- the child's sole co-manager.
--
-- The consequence is that a shared child cannot be deleted at all today. That
-- needs a product answer (a joint delete? a request the other must confirm?),
-- and refusing is the reversible half of the choice.
drop policy children_delete_owner on public.children;
create policy children_delete_sole_manager on public.children
  for delete to authenticated
  using (public.has_child_manage(id) and public.child_manager_count(id) = 1);

-- ---------------------------------------------------------------- invites --

-- The token never lands in the database. The link carries it, the server hashes
-- it, and only the hash is stored — so a leaked backup or a stray log line
-- cannot be replayed into access.
create table public.child_invites (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Fixed before the link exists, so a forwarded link cannot escalate: the
  -- person opening it never gets to say what they are joining as.
  role        public.child_role not null check (role in ('owner', 'viewer')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  -- Single use. Set once, by the first person through the door.
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

create index child_invites_child_id_idx on public.child_invites (child_id);

alter table public.child_invites enable row level security;

-- No policies and no grants: every read and write goes through the functions
-- below, which check membership or the token first. A table nobody can select
-- from cannot be enumerated.
revoke all on public.child_invites from anon, authenticated;

-- --------------------------------------------------------- access, as data --

create or replace function public.my_child_role(p_child_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role::text
  from public.child_members m
  where m.child_id = p_child_id
    and m.user_id = (select auth.uid());
$$;

create or replace function public.child_access(p_child_id uuid)
returns table (
  user_id      uuid,
  display_name text,
  role         public.child_role,
  since        timestamptz,
  is_self      boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id,
         coalesce(p.display_name, 'Någon'),
         m.role,
         m.created_at,
         m.user_id = (select auth.uid())
  from public.child_members m
  left join public.profiles p on p.id = m.user_id
  where m.child_id = p_child_id
    and public.has_child_access(p_child_id)
  order by m.created_at, m.user_id;
$$;

revoke all on function public.my_child_role(uuid) from public;
revoke all on function public.child_access(uuid) from public;
grant execute on function public.my_child_role(uuid) to authenticated;
grant execute on function public.child_access(uuid) to authenticated;

-- ------------------------------------------------------- making an invite --

-- Returns when the link stops working. "Ny länk" on the invite screen calls
-- this again, and the caller's earlier unused link for this child dies with it:
-- a parent who makes a new link because the first one went to the wrong number
-- means the first one to stop working.
create or replace function public.create_child_invite(
  p_child_id   uuid,
  p_role       text,
  p_token_hash text
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor      uuid := (select auth.uid());
  v_expires  timestamptz := now() + interval '7 days';
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.has_child_manage(p_child_id) then
    raise exception 'not allowed to share this child';
  end if;
  if p_role not in ('owner', 'viewer') then
    raise exception 'unknown role %', p_role;
  end if;

  delete from public.child_invites
   where child_id = p_child_id
     and created_by = actor
     and accepted_at is null;

  insert into public.child_invites (child_id, token_hash, role, created_by, expires_at)
  values (p_child_id, p_token_hash, p_role::public.child_role, actor, v_expires);

  return v_expires;
end;
$$;

-- What the accept screen shows before anyone has an account. Callable signed
-- out, which is the whole point of it: the invitee reads who shared what with
-- them, and decides, before creating anything.
--
-- Only a usable invite reveals a child. A dead link gets its status and nothing
-- else, so a forwarded or stale link is not a way to learn a child's name.
create or replace function public.child_invite_preview(p_token_hash text)
returns table (
  status         text,
  child_id       uuid,
  child_name     text,
  child_sex      text,
  role           public.child_role,
  invited_by     text,
  expires_at     timestamptz,
  already_member boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  inv record;
begin
  select i.child_id, i.role, i.expires_at, i.accepted_at,
         c.name as child_name, c.sex as child_sex,
         coalesce(p.display_name, 'Någon') as invited_by
    into inv
    from public.child_invites i
    join public.children c on c.id = i.child_id
    left join public.profiles p on p.id = i.created_by
   where i.token_hash = p_token_hash;

  if not found then
    return query select 'missing'::text, null::uuid, null::text, null::text,
                        null::public.child_role, null::text, null::timestamptz, false;
    return;
  end if;

  if inv.accepted_at is not null then
    return query select 'used'::text, null::uuid, null::text, null::text,
                        null::public.child_role, null::text, null::timestamptz, false;
    return;
  end if;

  if inv.expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::text, null::text,
                        null::public.child_role, null::text, null::timestamptz, false;
    return;
  end if;

  return query
    select 'ok'::text,
           inv.child_id,
           inv.child_name,
           inv.child_sex,
           inv.role,
           inv.invited_by,
           inv.expires_at,
           (select auth.uid()) is not null and exists (
             select 1 from public.child_members m
             where m.child_id = inv.child_id and m.user_id = (select auth.uid()));
end;
$$;

-- Taking the invite. The role comes off the row, never off the request, and the
-- row is locked while it is claimed so two people opening the same link at the
-- same moment cannot both get in.
create or replace function public.accept_child_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor    uuid := (select auth.uid());
  inv      public.child_invites;
  existing public.child_role;
begin
  if actor is null then
    raise exception 'invite_unauthenticated';
  end if;

  select * into inv from public.child_invites
   where token_hash = p_token_hash
   for update;

  if not found then
    raise exception 'invite_missing';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_used';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  select m.role into existing
    from public.child_members m
   where m.child_id = inv.child_id and m.user_id = actor;

  if existing is null then
    insert into public.child_members (child_id, user_id, role)
    values (inv.child_id, actor, inv.role);
  elsif existing = 'viewer' and inv.role = 'owner' then
    -- Joining again as a co-manager is the one role change there is. It never
    -- runs the other way: an 'owner' membership is not downgraded by a
    -- view-only link.
    update public.child_members set role = 'owner'
     where child_id = inv.child_id and user_id = actor;
  end if;

  update public.child_invites
     set accepted_at = now(), accepted_by = actor
   where id = inv.id;

  return inv.child_id;
end;
$$;

-- Revoking view-only access. Deleting the membership is all it does — no
-- notification, by design. The person's app stops showing the child, which is
-- state rather than a message.
create or replace function public.revoke_child_access(p_child_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.child_role;
begin
  if not public.has_child_manage(p_child_id) then
    raise exception 'not allowed to change access for this child';
  end if;

  select m.role into target
    from public.child_members m
   where m.child_id = p_child_id and m.user_id = p_user_id;

  if target is null then
    return;
  end if;
  if target <> 'viewer' then
    raise exception 'a co-manager cannot be removed';
  end if;

  delete from public.child_members
   where child_id = p_child_id and user_id = p_user_id;
end;
$$;

revoke all on function public.create_child_invite(uuid, text, text) from public;
revoke all on function public.child_invite_preview(text) from public;
revoke all on function public.accept_child_invite(text) from public;
revoke all on function public.revoke_child_access(uuid, uuid) from public;

grant execute on function public.create_child_invite(uuid, text, text) to authenticated;
-- The one function a signed-out caller may run: reading an invite it holds the
-- token for.
grant execute on function public.child_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_child_invite(text) to authenticated;
grant execute on function public.revoke_child_access(uuid, uuid) to authenticated;
