-- =============================================================================
-- Home Poker — migration 003: link players to accounts by phone, game invites, push subscriptions
-- Run once in Supabase → SQL Editor, after schema.sql and 002. Safe to re-run.
--
-- Privacy model
--   * Raw phone numbers never reach the server. The app sends SHA-256 of the E.164 number
--     (e.g. sha256("+972501234567")), and even those hashes live in tables with NO read policy:
--     they are only touched by the security-definer functions below.
--   * Looking someone up by phone is rate limited and returns only a name + character, and only for
--     people who allowed it (discoverable). The admin then confirms "is this them?" before linking.
--   * Claiming old history by phone alone requires a phone number VERIFIED by SMS (auth.users.phone),
--     so nobody can take over someone else's stats by typing their number.
-- =============================================================================

-- My phone (hash only) + whether friends may find me by it.
create table if not exists public.user_phones (
  user_id      uuid primary key references auth.users on delete cascade,
  phone_hash   text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  last4        text not null default '' check (last4 ~ '^[0-9]{0,4}$'),
  discoverable boolean not null default true,
  updated_at   timestamptz not null default now()
);
create index if not exists user_phones_hash_idx on public.user_phones (phone_hash);
alter table public.user_phones enable row level security;   -- no policies: functions only

-- Phone (hash) the admin entered for a table player who has no account yet: lets that history
-- follow them once they sign up and verify the number.
create table if not exists public.player_phones (
  player_id  uuid primary key references public.group_players on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$')
);
create index if not exists player_phones_hash_idx on public.player_phones (phone_hash);
alter table public.player_phones enable row level security; -- no policies: functions only

-- Rate limiting for lookups and invites.
create table if not exists public.phone_lookups (
  user_id uuid not null references auth.users on delete cascade,
  kind    text not null default 'lookup',
  at      timestamptz not null default now()
);
create index if not exists phone_lookups_user_idx on public.phone_lookups (user_id, kind, at);
alter table public.phone_lookups enable row level security;

-- "You were added to a game": what the app shows on open (and what push notifications point to).
create table if not exists public.game_invites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  invited_by uuid references auth.users on delete set null,
  view_token text not null check (char_length(view_token) between 8 and 80),
  table_name text not null default '' check (char_length(table_name) <= 60),
  host_name  text not null default '' check (char_length(host_name) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists game_invites_user_idx on public.game_invites (user_id, created_at desc);
alter table public.game_invites enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_invites' and policyname = 'invites_own_read') then
    create policy invites_own_read on public.game_invites for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_invites' and policyname = 'invites_own_delete') then
    create policy invites_own_delete on public.game_invites for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;
grant select, delete on public.game_invites to authenticated;

-- Web Push subscriptions (one per device).
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) < 1000),
  p256dh     text not null check (char_length(p256dh) < 200),
  auth       text not null check (char_length(auth) < 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_own') then
    create policy push_own on public.push_subscriptions for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------- functions
create or replace function public.rate_ok(p_kind text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from phone_lookups where at < now() - interval '2 days';
  if (select count(*) from phone_lookups where user_id = auth.uid() and kind = p_kind and at > now() - p_window) >= p_max then
    return false;
  end if;
  insert into phone_lookups (user_id, kind) values (auth.uid(), p_kind);
  return true;
end $$;

-- Save / change / remove my phone (hash) and visibility.
create or replace function public.set_my_phone(p_hash text, p_last4 text, p_discoverable boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_hash is null or p_hash = '' then delete from user_phones where user_id = auth.uid(); return; end if;
  insert into user_phones (user_id, phone_hash, last4, discoverable)
  values (auth.uid(), lower(p_hash), coalesce(p_last4, ''), coalesce(p_discoverable, true))
  on conflict (user_id) do update set phone_hash = excluded.phone_hash, last4 = excluded.last4,
    discoverable = excluded.discoverable, updated_at = now();
end $$;

create or replace function public.my_phone()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('last4', last4, 'discoverable', discoverable,
    'verified', exists (select 1 from auth.users u where u.id = auth.uid() and u.phone_confirmed_at is not null
                        and encode(sha256(convert_to('+' || u.phone, 'UTF8')), 'hex') = user_phones.phone_hash))
  from user_phones where user_id = auth.uid();
$$;

-- Admin: "is this phone a registered player?" → name + character (for the admin to confirm), or nothing.
create or replace function public.find_user_by_phone(p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid; prof profiles;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not rate_ok('lookup', 40, interval '1 hour') then raise exception 'too many lookups, try later' using errcode = '54000'; end if;
  select user_id into u from user_phones where phone_hash = lower(p_hash) and discoverable order by updated_at desc limit 1;
  if u is null then return null; end if;
  select * into prof from profiles where id = u;
  return jsonb_build_object('user_id', u, 'display_name', coalesce(prof.display_name, ''),
                            'avatar', coalesce(prof.avatar, 0), 'color', coalesce(to_jsonb(prof) ->> 'color', ''));
end $$;

-- Admin (a member of the table): attach a phone to a table player, and, when it belongs to a
-- registered user, link that player to their account (stats + character) and seat them at the table.
-- p_user must be the account that phone belongs to, so the caller can't link arbitrary accounts.
create or replace function public.link_player(p_group uuid, p_name text, p_hash text, p_user uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not is_member(p_group) then raise exception 'not a member' using errcode = '42501'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad phone'; end if;
  if p_user is not null and not exists (select 1 from user_phones where user_id = p_user and phone_hash = lower(p_hash) and discoverable) then
    raise exception 'phone does not match that user' using errcode = '42501';
  end if;

  insert into group_players (group_id, name, avatar) values (p_group, trim(p_name), 0)
  on conflict (group_id, lower(name)) do update set avatar = group_players.avatar
  returning id into pid;

  insert into player_phones (player_id, phone_hash) values (pid, lower(p_hash))
  on conflict (player_id) do update set phone_hash = excluded.phone_hash;

  if p_user is not null then
    -- one player per user per table; never steal a player someone else already claimed
    if not exists (select 1 from group_players where group_id = p_group and claimed_by = p_user)
       and exists (select 1 from group_players where id = pid and claimed_by is null) then
      update group_players set claimed_by = p_user where id = pid;
    end if;
    insert into group_members (group_id, user_id, role) values (p_group, p_user, 'member') on conflict do nothing;
  end if;
  return pid;
end $$;

-- After verifying my phone by SMS: take over every table player that was saved with my number.
create or replace function public.claim_by_phone()
returns int language plpgsql security definer set search_path = public as $$
declare h text; n int := 0; r record;
begin
  select encode(sha256(convert_to('+' || phone, 'UTF8')), 'hex') into h
  from auth.users where id = auth.uid() and phone_confirmed_at is not null and coalesce(phone, '') <> '';
  if h is null then raise exception 'phone not verified' using errcode = '42501'; end if;

  insert into user_phones (user_id, phone_hash, last4) values (auth.uid(), h, right((select phone from auth.users where id = auth.uid()), 4))
  on conflict (user_id) do update set phone_hash = excluded.phone_hash, last4 = excluded.last4, updated_at = now();

  for r in
    select gp.id, gp.group_id from player_phones pp join group_players gp on gp.id = pp.player_id
    where pp.phone_hash = h and gp.claimed_by is null
  loop
    if not exists (select 1 from group_players where group_id = r.group_id and claimed_by = auth.uid()) then
      update group_players set claimed_by = auth.uid() where id = r.id;
      insert into group_members (group_id, user_id, role) values (r.group_id, auth.uid(), 'member') on conflict do nothing;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Host: tell a registered player they were added to a live game (in-app pop-up + push).
-- Only for a user the host just linked by phone, or someone already sharing a table with the host.
create or replace function public.invite_to_game(p_user uuid, p_token text, p_table text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare iid uuid; host text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_user = auth.uid() then return null; end if;
  if not exists (select 1 from live_games where view_token = p_token and updated_at > now() - interval '1 day') then
    raise exception 'no such live game';
  end if;
  if not exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user
  ) and not exists (select 1 from user_phones where user_id = p_user and discoverable) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not rate_ok('invite', 40, interval '1 day') then raise exception 'too many invites' using errcode = '54000'; end if;
  -- one invite per game per player
  select id into iid from game_invites where user_id = p_user and view_token = p_token;
  if iid is not null then return iid; end if;
  select display_name into host from profiles where id = auth.uid();
  insert into game_invites (user_id, invited_by, view_token, table_name, host_name)
  values (p_user, auth.uid(), p_token, left(coalesce(p_table, ''), 60), left(coalesce(host, ''), 60))
  returning id into iid;
  delete from game_invites where created_at < now() - interval '3 days';
  return iid;
end $$;

revoke execute on function public.rate_ok(text, int, interval) from public, anon, authenticated;
revoke execute on function public.set_my_phone(text, text, boolean), public.my_phone(), public.find_user_by_phone(text),
  public.link_player(uuid, text, text, uuid), public.claim_by_phone(), public.invite_to_game(uuid, text, text) from public, anon;
grant execute on function public.set_my_phone(text, text, boolean), public.my_phone(), public.find_user_by_phone(text),
  public.link_player(uuid, text, text, uuid), public.claim_by_phone(), public.invite_to_game(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- "this is me" when joining a table (no SMS)
-- Unclaimed players at a table I belong to, with how many nights each has, and whether the phone the
-- host saved for them matches the phone I entered in my profile (so the app can suggest the right one).
-- Claiming itself stays an explicit tap (claim_player), so a typed phone alone never takes over anything.
create or replace function public.table_claim_options(p_group uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', gp.id, 'name', gp.name, 'avatar', gp.avatar,
           'games', (select count(*) from game_results r join games g on g.id = r.game_id where r.player_id = gp.id and g.deleted_at is null),
           'phone_match', exists (select 1 from player_phones pp join user_phones up on up.phone_hash = pp.phone_hash
                                  where pp.player_id = gp.id and up.user_id = auth.uid()))
         order by gp.name), '[]'::jsonb)
  from group_players gp
  where gp.group_id = p_group and gp.claimed_by is null and is_member(p_group)
    and not exists (select 1 from group_players x where x.group_id = p_group and x.claimed_by = auth.uid());
$$;
revoke execute on function public.table_claim_options(uuid) from public, anon;
grant execute on function public.table_claim_options(uuid) to authenticated;
