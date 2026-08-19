-- A name the user types at sign-up.
--
-- Until now a display name was derived from the email's local part, which reads
-- as a name often enough ("erik.svensson@" becomes "Erik Svensson") and as
-- noise the rest of the time. The sign-up form now asks for the real one. The
-- field is optional: an empty one keeps the derived name, so nothing about the
-- accounts that already exist changes.
--
-- Nothing here is unique, deliberately. Two parents who share a name — and in a
-- household with one shared surname that is the ordinary case — must both be
-- able to sign up. A name is not an identifier anywhere in this schema: access
-- is by user id, the name is only ever printed. The access screen already tells
-- the reader which row is theirs, which is what disambiguates two Anna Nilsson.
--
-- The name arrives in raw_user_meta_data, which is the user's own writable
-- metadata: it is whatever the client sent, of whatever length, and reachable
-- through the auth API without going near this app. So it is treated as
-- untrusted text here rather than only in the form — whitespace collapsed,
-- trimmed, cut to 60 characters — and the derived name still stands behind it
-- for anything that sanitises down to nothing.

create or replace function public.display_name_from_meta(p_meta jsonb, p_email text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      btrim(left(btrim(regexp_replace(coalesce(p_meta ->> 'display_name', ''),
                                      '[[:space:][:cntrl:]]+', ' ', 'g')), 60)),
      ''),
    public.display_name_from_email(p_email));
$$;

-- Same trigger as before, one column wider on the way in. It still fires on
-- insert and on an email change only: a name typed at sign-up is there at
-- insert, and there is still no screen for editing it afterwards. Giving people
-- one means adding raw_user_meta_data to the trigger's column list, and this
-- function is already written for it.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email,
          public.display_name_from_meta(new.raw_user_meta_data, new.email))
  on conflict (id) do update
    set email        = excluded.email,
        display_name = excluded.display_name;
  return new;
end;
$$;
