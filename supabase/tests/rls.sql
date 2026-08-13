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
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- Names for the sharing tests. Updating the email is also what the profile
-- trigger listens for, so this exercises its update path.
update auth.users set email = 'erik.svensson@example.com'
 where id = '11111111-1111-1111-1111-111111111111';
update auth.users set email = 'ingrid@example.com'
 where id = '22222222-2222-2222-2222-222222222222';
update auth.users set email = 'moa@example.com'
 where id = '33333333-3333-3333-3333-333333333333';

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

-- ------------------------------------------------------------------ sharing --
--
-- The rules the design states in Swedish, checked as SQL. A "Kan se" user who
-- POSTs a measurement has to be refused by Postgres, not by a missing button,
-- and a co-manager has to be unremovable by every route there is.

set role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

select pg_temp.expect(
  (select display_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') = 'Erik Svensson',
  'the profile trigger should derive a display name from the email');

insert into t values ('shared', public.create_child('Vega', 'female', date '2026-01-05', 40::smallint, 0::smallint)::text);

insert into public.measurements (child_id, measured_on, weight_grams, length_mm)
values ((select value::uuid from t where key = 'shared'), date '2026-01-05', 3480, 500);

select pg_temp.expect(
  (select created_by from public.measurements
    where child_id = (select value::uuid from t where key = 'shared'))
    = '11111111-1111-1111-1111-111111111111',
  'a measurement should be stamped with its author');

-- A caller writing someone else's id into created_by is overwritten, not
-- trusted: attribution is the database's to say.
insert into public.measurements (child_id, measured_on, weight_grams, created_by)
values ((select value::uuid from t where key = 'shared'), date '2026-02-05', 4600,
        '22222222-2222-2222-2222-222222222222');
select pg_temp.expect(
  (select count(*) from public.measurements
    where child_id = (select value::uuid from t where key = 'shared')
      and created_by = '22222222-2222-2222-2222-222222222222') = 0,
  'created_by should be stamped by the database, not by the caller');

-- ------------------------------------------------------- an invite, in full --

select public.create_child_invite(
  (select value::uuid from t where key = 'shared'), 'viewer', repeat('a', 64));

select pg_temp.expect_denied(
  format('select public.create_child_invite(%L, ''owner'', ''nothexadecimal'')',
         (select value from t where key = 'shared')),
  'an invite whose token hash is not a sha256');

-- Nobody selects from the invite table, including the person who made the row.
select pg_temp.expect_denied('select count(*) from public.child_invites',
  'reading the invite table directly');

-- ------------------------------------------------------------- as Ingrid, B --

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');

select pg_temp.expect(
  (select status from public.child_invite_preview(repeat('a', 64))) = 'ok',
  'a live invite should preview as usable');
select pg_temp.expect(
  (select child_name from public.child_invite_preview(repeat('a', 64))) = 'Vega',
  'the preview should name the child');
select pg_temp.expect(
  (select invited_by from public.child_invite_preview(repeat('a', 64))) = 'Erik Svensson',
  'the preview should name who is sharing');
select pg_temp.expect(
  (select status from public.child_invite_preview(repeat('f', 64))) = 'missing',
  'an unknown token should preview as missing');
select pg_temp.expect(
  (select child_name from public.child_invite_preview(repeat('f', 64))) is null,
  'a dead link must not reveal a child');

select pg_temp.expect(
  public.accept_child_invite(repeat('a', 64)) = (select value::uuid from t where key = 'shared'),
  'accepting an invite should return the child');
select pg_temp.expect(
  (select public.my_child_role((select value::uuid from t where key = 'shared'))) = 'viewer',
  'the role should come off the invite row');

select pg_temp.expect((select count(*) from public.children) = 1, 'B should now see the child');
select pg_temp.expect((select count(*) from public.measurements) = 2,
  'B should see the measurements');

-- ------------------------------------------------ what "Kan se" cannot do --

select pg_temp.expect_denied(
  format('insert into public.measurements (child_id, measured_on, weight_grams) values (%L, date ''2026-03-05'', 5200)',
         (select value from t where key = 'shared')),
  'a view-only user adding a measurement');

update public.measurements set weight_grams = 9000;
select pg_temp.expect((select count(*) from public.measurements where weight_grams = 9000) = 0,
  'a view-only user must not be able to edit a measurement');

delete from public.measurements;
select pg_temp.expect((select count(*) from public.measurements) = 2,
  'a view-only user must not be able to delete a measurement');

update public.children set name = 'Bytt';
select pg_temp.expect((select count(*) from public.children where name = 'Bytt') = 0,
  'a view-only user must not be able to rename the child');

delete from public.children;
select pg_temp.expect((select count(*) from public.children) = 1,
  'a view-only user must not be able to delete the child');

select pg_temp.expect_denied(
  format('select public.create_child_invite(%L, ''viewer'', %L)',
         (select value from t where key = 'shared'), repeat('b', 64)),
  'a view-only user inviting someone');

select pg_temp.expect_denied(
  format('select public.revoke_child_access(%L, ''11111111-1111-1111-1111-111111111111'')',
         (select value from t where key = 'shared')),
  'a view-only user revoking a co-manager');

-- A view-only user cannot let themselves out either. Leaving is not designed
-- yet, and the schema does not quietly allow it.
delete from public.child_members where user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect(
  (select public.my_child_role((select value::uuid from t where key = 'shared'))) = 'viewer',
  'a view-only user must not be able to remove themselves');

-- They do see the household, which is the access screen's own data.
select pg_temp.expect(
  (select count(*) from public.child_access((select value::uuid from t where key = 'shared'))) = 2,
  'everyone with access should see who else has access');
select pg_temp.expect(
  (select display_name from public.child_access((select value::uuid from t where key = 'shared'))
    where not is_self) = 'Erik Svensson',
  'the access list should carry names');

-- ------------------------------------------------------ single use, expiry --

select pg_temp.act_as('33333333-3333-3333-3333-333333333333');

select pg_temp.expect(
  (select status from public.child_invite_preview(repeat('a', 64))) = 'used',
  'a used invite should preview as used');
select pg_temp.expect_denied(
  format('select public.accept_child_invite(%L)', repeat('a', 64)),
  'a second person taking the same link');
select pg_temp.expect(
  (select public.my_child_role((select value::uuid from t where key = 'shared'))) is null,
  'the second person should have no access');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.create_child_invite(
  (select value::uuid from t where key = 'shared'), 'viewer', repeat('c', 64));
reset role;
update public.child_invites set expires_at = now() - interval '1 day'
 where token_hash = repeat('c', 64);
set role authenticated;

select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
select pg_temp.expect(
  (select status from public.child_invite_preview(repeat('c', 64))) = 'expired',
  'an invite past seven days should preview as expired');
select pg_temp.expect_denied(
  format('select public.accept_child_invite(%L)', repeat('c', 64)),
  'accepting an expired invite');

-- ----------------------------------------------- a second co-manager, for good --

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.create_child_invite(
  (select value::uuid from t where key = 'shared'), 'owner', repeat('d', 64));

select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
select public.accept_child_invite(repeat('d', 64));
select pg_temp.expect(
  (select public.my_child_role((select value::uuid from t where key = 'shared'))) = 'owner',
  'a co-manager invite should grant co-management');

insert into public.measurements (child_id, measured_on, weight_grams)
values ((select value::uuid from t where key = 'shared'), date '2026-03-05', 5200);
select pg_temp.expect((select count(*) from public.measurements) = 3,
  'a co-manager should be able to add a measurement');

-- Neither can remove the other, by either route.
select pg_temp.expect_denied(
  format('select public.revoke_child_access(%L, ''11111111-1111-1111-1111-111111111111'')',
         (select value from t where key = 'shared')),
  'a co-manager removing the other co-manager');

delete from public.child_members where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect(
  (select count(*) from public.child_members
    where child_id = (select value::uuid from t where key = 'shared')) = 3,
  'a co-manager must not be removable by a direct delete either');

-- Nor demote them: there is no update policy on child_members at all, so a role
-- only ever changes by taking an invite.
update public.child_members set role = 'viewer'
 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect(
  (select count(*) from public.child_members
    where child_id = (select value::uuid from t where key = 'shared')
      and role = 'owner') = 2,
  'a co-manager must not be demotable');

-- Nor can one of them delete the child out from under the other, which would be
-- the same thing by another name.
delete from public.children;
select pg_temp.expect((select count(*) from public.children) = 1,
  'a shared child must not be deletable by one of its co-managers');

-- Editing someone else's measurement is allowed; rewriting who entered it is
-- not. Attribution survives the edit.
update public.measurements set weight_grams = 3500
 where measured_on = date '2026-01-05';
select pg_temp.expect(
  (select created_by from public.measurements where measured_on = date '2026-01-05')
    = '11111111-1111-1111-1111-111111111111',
  'editing a measurement must not move its authorship');

-- ------------------------------------------------------------- revoking B --

select pg_temp.expect(
  (select count(*) from public.child_access((select value::uuid from t where key = 'shared'))) = 3,
  'three people should have access before the revoke');

select public.revoke_child_access(
  (select value::uuid from t where key = 'shared'), '22222222-2222-2222-2222-222222222222');

select pg_temp.expect(
  (select count(*) from public.child_access((select value::uuid from t where key = 'shared'))) = 2,
  'revoking should remove the membership');

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.expect((select count(*) from public.children) = 0,
  'a revoked user should stop seeing the child');
select pg_temp.expect((select count(*) from public.measurements) = 0,
  'a revoked user should stop seeing the measurements');
select pg_temp.expect(
  (select count(*) from public.child_access((select value::uuid from t where key = 'shared'))) = 0,
  'a revoked user should not be able to read the access list');
select pg_temp.expect(
  (select count(*) from public.profiles) = 1,
  'a user should only ever see their own profile row');

\echo 'RLS tests passed'

rollback;
