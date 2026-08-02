-- Kurvan: children, membership and measurements.
--
-- Two decisions here are deliberately awkward for the prototype and cheap
-- later:
--
--   * A child has no owner_id. Access comes from child_members, so adding a
--     second parent or a read-only grandparent is one row, not a migration
--     that rewrites ownership.
--   * Row-level security is on from this first migration and every policy is
--     written against child_members. Retrofitting RLS is how data leaks
--     happen.
--
-- Measurements store raw measured values only. SDS is computed on read from
-- the static reference, so correcting the reference never leaves stale derived
-- numbers in the database.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- children --

create table public.children (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null check (length(btrim(name)) between 1 and 100),
  sex           text        not null check (sex in ('female', 'male')),
  birth_date    date        not null,
  -- Gestational age at birth. Required, not a nicety: it decides where the
  -- whole curve sits. Term is 37+0 through 42+0; anything else is out of
  -- scope for this reference and is refused at the boundary.
  gestation_weeks smallint  not null check (gestation_weeks between 37 and 42),
  gestation_days  smallint  not null check (gestation_days between 0 and 6),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint children_gestation_within_term
    check (gestation_weeks * 7 + gestation_days between 259 and 294)
);

-- ------------------------------------------------------------ child_members --

-- Roles the schema understands from day one. The prototype only ever creates
-- one 'owner' row per child; 'editor' and 'viewer' exist so sharing and
-- read-only access need no ownership rewrite.
create type public.child_role as enum ('owner', 'editor', 'viewer');

create table public.child_members (
  child_id   uuid not null references public.children (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.child_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (child_id, user_id)
);

create index child_members_user_id_idx on public.child_members (user_id);

-- ------------------------------------------------------------ measurements --

create table public.measurements (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.children (id) on delete cascade,
  -- The date the child was measured, which is not the date the row was
  -- created: a parent copying in from the BVC card backfills months later.
  measured_on  date not null,
  -- Integers in grams and millimetres. Medical values do not go in floats.
  -- Any single one may be present alone; BVC weighs more often than it
  -- measures length.
  weight_grams integer check (weight_grams between 300 and 30000),
  length_mm    integer check (length_mm between 250 and 1200),
  head_mm      integer check (head_mm between 200 and 700),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint measurements_at_least_one_value
    check (weight_grams is not null or length_mm is not null or head_mm is not null)
);

create index measurements_child_measured_on_idx
  on public.measurements (child_id, measured_on);

-- A measurement cannot predate the child. Cross-table, so it needs a trigger
-- rather than a check constraint.
-- Security definer so the check reads the child's real birth date rather than
-- whatever the caller can see. Without it, a caller with no access to the child
-- fails here with "unknown child" instead of failing on the access policy that
-- is actually refusing them.
create or replace function public.measurement_not_before_birth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  birth date;
begin
  select c.birth_date into birth from public.children c where c.id = new.child_id;
  if birth is null then
    raise exception 'unknown child %', new.child_id;
  end if;
  if new.measured_on < birth then
    raise exception 'measured_on % is before the child''s birth date %', new.measured_on, birth;
  end if;
  return new;
end;
$$;

create trigger measurements_not_before_birth
  before insert or update on public.measurements
  for each row execute function public.measurement_not_before_birth();

-- The same invariant from the other side: moving a child's birth date forward
-- must not strand measurements before it.
create or replace function public.birth_date_not_after_measurements()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  earliest date;
begin
  if new.birth_date <= old.birth_date then
    return new;
  end if;
  select min(m.measured_on) into earliest
  from public.measurements m
  where m.child_id = new.id;
  if earliest is not null and new.birth_date > earliest then
    raise exception 'birth_date % is after the earliest measurement %', new.birth_date, earliest;
  end if;
  return new;
end;
$$;

create trigger children_birth_date_not_after_measurements
  before update of birth_date on public.children
  for each row execute function public.birth_date_not_after_measurements();

-- ------------------------------------------------------------- updated_at --

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger children_touch_updated_at
  before update on public.children
  for each row execute function public.touch_updated_at();

create trigger measurements_touch_updated_at
  before update on public.measurements
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------ access rules --

-- Both helpers are security definer with a pinned search_path so a policy on
-- children can consult child_members without tripping over that table's own
-- policies.
create or replace function public.has_child_access(target_child uuid)
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
  );
$$;

create or replace function public.has_child_write(target_child uuid)
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
      and m.role in ('owner', 'editor')
  );
$$;

revoke all on function public.has_child_access(uuid) from public;
revoke all on function public.has_child_write(uuid) from public;
grant execute on function public.has_child_access(uuid) to authenticated;
grant execute on function public.has_child_write(uuid) to authenticated;

alter table public.children      enable row level security;
alter table public.child_members enable row level security;
alter table public.measurements  enable row level security;

-- Supabase's default privileges would grant these to anon as well. Signed-out
-- callers have no auth.uid(), so no policy could match, but there is no reason
-- for the grant to exist at all.
grant select, insert, update, delete
  on public.children, public.child_members, public.measurements
  to authenticated;
revoke all
  on public.children, public.child_members, public.measurements
  from anon;

-- children ------------------------------------------------------------------

create policy children_select_member on public.children
  for select to authenticated
  using (public.has_child_access(id));

create policy children_update_writer on public.children
  for update to authenticated
  using (public.has_child_write(id))
  with check (public.has_child_write(id));

create policy children_delete_owner on public.children
  for delete to authenticated
  using (
    exists (
      select 1 from public.child_members m
      where m.child_id = children.id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  );

-- No insert policy. A child and its first membership row have to appear
-- together or not at all, so creation goes through public.create_child below.

-- child_members -------------------------------------------------------------

create policy child_members_select_own on public.child_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert, update or delete policies: sharing is out of scope, and the only
-- membership row the prototype creates is written by create_child.

-- measurements --------------------------------------------------------------

create policy measurements_select_member on public.measurements
  for select to authenticated
  using (public.has_child_access(child_id));

create policy measurements_insert_writer on public.measurements
  for insert to authenticated
  with check (public.has_child_write(child_id));

create policy measurements_update_writer on public.measurements
  for update to authenticated
  using (public.has_child_write(child_id))
  with check (public.has_child_write(child_id));

create policy measurements_delete_writer on public.measurements
  for delete to authenticated
  using (public.has_child_write(child_id));

-- --------------------------------------------------------- child creation --

-- Creating a child and its owner membership in one statement, so a failure
-- part-way cannot leave a child nobody can see.
create or replace function public.create_child(
  p_name            text,
  p_sex             text,
  p_birth_date      date,
  p_gestation_weeks smallint,
  p_gestation_days  smallint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id  uuid;
  actor   uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  insert into public.children (name, sex, birth_date, gestation_weeks, gestation_days)
  values (btrim(p_name), p_sex, p_birth_date, p_gestation_weeks, p_gestation_days)
  returning id into new_id;

  insert into public.child_members (child_id, user_id, role)
  values (new_id, actor, 'owner');

  return new_id;
end;
$$;

revoke all on function public.create_child(text, text, date, smallint, smallint) from public;
grant execute on function public.create_child(text, text, date, smallint, smallint) to authenticated;
