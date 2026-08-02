-- Row-level security tests.
--
-- Run against a local Supabase database:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--
-- Every check aborts the script on failure, so a clean run means the policies
-- did what they claim. The whole thing runs in a transaction and rolls back.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

begin;

-- Scratch space for ids, readable by the roles we switch into below.
create temporary table t (key text primary key, value text);
grant select, insert on t to authenticated, anon;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222')
on conflict do nothing;

create or replace function pg_temp.act_as(uid text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
end;
$$;

create or replace function pg_temp.expect_denied(stmt text, what text) returns void
language plpgsql as $$
declare
  denied boolean := false;
begin
  begin
    execute stmt;
  exception when others then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL: % was allowed', what;
  end if;
end;
$$;

create or replace function pg_temp.expect(cond boolean, what text) returns void
language plpgsql as $$
begin
  if not cond then raise exception 'FAIL: %', what; end if;
end;
$$;

-- ---------------------------------------------------------------- as user A --

set role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

insert into t values ('child', public.create_child('Elsa', 'female', date '2025-08-10', 39::smallint, 2::smallint)::text);

select pg_temp.expect((select count(*) from public.children) = 1, 'A should see the child it created');
select pg_temp.expect(
  (select count(*) from public.child_members where role = 'owner') = 1,
  'create_child should give the creator an owner membership');

insert into public.measurements (child_id, measured_on, weight_grams)
values ((select value::uuid from t where key = 'child'), date '2025-09-07', 4220);
select pg_temp.expect((select count(*) from public.measurements) = 1,
  'a weight-only measurement should be accepted');

insert into public.measurements (child_id, measured_on, length_mm, head_mm)
values ((select value::uuid from t where key = 'child'), date '2025-10-10', 570, 384);
select pg_temp.expect((select count(*) from public.measurements) = 2,
  'a measurement without weight should be accepted');

-- ------------------------------------------------------------- constraints --

select pg_temp.expect_denied(
  format('insert into public.measurements (child_id, measured_on) values (%L, date ''2025-09-08'')',
         (select value from t where key = 'child')),
  'a measurement with no values at all');

select pg_temp.expect_denied(
  format('insert into public.measurements (child_id, measured_on, weight_grams) values (%L, date ''2025-08-09'', 4000)',
         (select value from t where key = 'child')),
  'a measurement dated before the birth date');

select pg_temp.expect_denied(
  format('insert into public.measurements (child_id, measured_on, weight_grams) values (%L, date ''2025-09-09'', 45000)',
         (select value from t where key = 'child')),
  'a 45 kg weight');

select pg_temp.expect_denied(
  'update public.children set birth_date = date ''2025-09-20''',
  'moving the birth date past an existing measurement');

select pg_temp.expect_denied(
  'select public.create_child(''Tidig'', ''male'', date ''2025-08-10'', 36::smallint, 0::smallint)',
  'a child born at 36 weeks');

select pg_temp.expect_denied(
  'select public.create_child(''Sen'', ''male'', date ''2025-08-10'', 42::smallint, 1::smallint)',
  'a child born at 42+1');

-- ------------------------------------------------------- the app's contract --

-- The exact call and column lists src/lib/db.ts and src/app/actions.ts use.
-- PostgREST calls functions with named arguments, so a renamed parameter would
-- only surface at runtime without this.
insert into t values ('child2', public.create_child(
  p_name            => 'Vidar',
  p_sex             => 'male',
  p_birth_date      => date '2026-02-02',
  p_gestation_weeks => 40::smallint,
  p_gestation_days  => 0::smallint
)::text);

select id, name, sex, birth_date, gestation_weeks, gestation_days
  from public.children where id = (select value::uuid from t where key = 'child2');

select id, child_id, measured_on, weight_grams, length_mm, head_mm
  from public.measurements where child_id = (select value::uuid from t where key = 'child');

select pg_temp.expect((select count(*) from public.children) = 2,
  'create_child with named arguments should have created a second child');

delete from public.children where id = (select value::uuid from t where key = 'child2');

-- ---------------------------------------------------------------- as user B --

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');

select pg_temp.expect((select count(*) from public.children) = 0, 'B must not see A''s child');
select pg_temp.expect((select count(*) from public.measurements) = 0, 'B must not see A''s measurements');
select pg_temp.expect((select count(*) from public.child_members) = 0, 'B must not see A''s membership');

select pg_temp.expect_denied(
  format('insert into public.measurements (child_id, measured_on, weight_grams) values (%L, date ''2025-10-01'', 5000)',
         (select value from t where key = 'child')),
  'B writing a measurement onto A''s child');

select pg_temp.expect_denied(
  format('insert into public.child_members (child_id, user_id, role) values (%L, ''22222222-2222-2222-2222-222222222222'', ''owner'')',
         (select value from t where key = 'child')),
  'B granting itself membership');

update public.children set name = 'Kapad';
select pg_temp.expect((select count(*) from public.children where name = 'Kapad') = 0,
  'B''s update must not touch A''s child');

delete from public.measurements;

-- ----------------------------------------------------------------- as anon --

reset role;
set role anon;
select pg_temp.act_as('');
select pg_temp.expect_denied('select count(*) from public.children', 'anon reading children');

-- ------------------------------------------------------ back to A, intact --

reset role;
set role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

select pg_temp.expect((select count(*) from public.measurements) = 2,
  'B''s delete must not have removed A''s measurements');
select pg_temp.expect((select name from public.children) = 'Elsa',
  'B''s update must not have renamed A''s child');

update public.children set name = 'Elsa Maria';
select pg_temp.expect((select name from public.children) = 'Elsa Maria', 'A should be able to rename');

delete from public.children;
select pg_temp.expect((select count(*) from public.children) = 0, 'A should be able to delete');
select pg_temp.expect((select count(*) from public.measurements) = 0,
  'deleting a child should cascade to its measurements');

reset role;
select pg_temp.expect((select count(*) from public.child_members) = 0,
  'deleting a child should cascade to its memberships');

\echo 'RLS tests passed'

rollback;
