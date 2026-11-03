-- =============================================================================
-- Home Poker — optional cloud module (Supabase / Postgres)
--
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query → Run.
-- It is idempotent-ish (safe to re-run after edits: it uses IF NOT EXISTS / OR REPLACE).
--
-- Design:
--   * The app stays local-first. Only FINISHED games are pushed, through one
--     idempotent RPC (record_game) keyed by the client-generated game id.
--   * Stats belong to "group players" (people at the table), not to accounts —
--     most players never install the app. A signed-in user may "claim" one.
--   * Every table has Row Level Security: only group members can read a group.
--   * Live view-only links (live_games) are reachable ONLY through RPCs that
--     require the secret write key (to update) or the view token (to read).
-- =============================================================================

-- ---------------------------------------------------------------- tables
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  avatar       int  not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.group_players (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  avatar     int  not null default 0,
  claimed_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists group_players_name_uq on public.group_players (group_id, lower(name));

create table if not exists public.games (
  id             text primary key,                 -- client-generated (idempotency key)
  group_id       uuid not null references public.groups on delete cascade,
  started_at     timestamptz,
  ended_at       timestamptz not null,
  chips_per_unit numeric not null default 1,
  currency       text not null default '₪',
  recorded_by    uuid references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists games_group_idx on public.games (group_id, ended_at desc);
create index if not exists games_updated_idx on public.games (group_id, updated_at);

create table if not exists public.game_results (
  game_id   text not null references public.games on delete cascade,
  player_id uuid not null references public.group_players on delete cascade,
  buy_in    numeric not null,
  cash_out  numeric not null,
  net       numeric not null,
  primary key (game_id, player_id)
);
create index if not exists game_results_player_idx on public.game_results (player_id);

create table if not exists public.settlements (
  id          bigint generated always as identity primary key,
  game_id     text not null references public.games on delete cascade,
  from_player uuid not null references public.group_players on delete cascade,
  to_player   uuid not null references public.group_players on delete cascade,
  amount      numeric not null check (amount > 0)
);
create index if not exists settlements_game_idx on public.settlements (game_id);

create table if not exists public.live_games (
  id         uuid primary key default gen_random_uuid(),
  view_token text not null unique,
  write_key  text not null,
  group_id   uuid references public.groups on delete set null,
  snapshot   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.is_admin(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.random_code(len int default 6)
returns text language sql volatile as $$
  -- No 0/O/1/I so codes are easy to read aloud.
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, len);
$$;

-- New account → profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RLS
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_players enable row level security;
alter table public.games         enable row level security;
alter table public.game_results  enable row level security;
alter table public.settlements   enable row level security;
alter table public.live_games    enable row level security;   -- no policies: RPC-only

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated using (public.is_member(id));
drop policy if exists groups_rename on public.groups;
create policy groups_rename on public.groups for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated using (created_by = auth.uid());

drop policy if exists members_read on public.group_members;
create policy members_read on public.group_members for select to authenticated using (public.is_member(group_id));
drop policy if exists members_leave on public.group_members;
create policy members_leave on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_admin(group_id));

drop policy if exists players_read on public.group_players;
create policy players_read on public.group_players for select to authenticated using (public.is_member(group_id));

drop policy if exists games_read on public.games;
create policy games_read on public.games for select to authenticated using (public.is_member(group_id));

drop policy if exists results_read on public.game_results;
create policy results_read on public.game_results for select to authenticated using (
  exists (select 1 from games g where g.id = game_results.game_id and public.is_member(g.group_id)));

drop policy if exists settlements_read on public.settlements;
create policy settlements_read on public.settlements for select to authenticated using (
  exists (select 1 from games g where g.id = settlements.game_id and public.is_member(g.group_id)));

-- ---------------------------------------------------------------- leaderboard
create or replace view public.group_leaderboard with (security_invoker = true) as
select
  gp.group_id,
  gp.id        as player_id,
  gp.name,
  gp.avatar,
  gp.claimed_by,
  count(r.game_id)::int                           as games,
  coalesce(sum(r.net), 0)                         as net,
  coalesce(sum(r.buy_in), 0)                      as total_buy_in,
  (count(*) filter (where r.net > 0))::int        as wins,
  coalesce(max(r.net), 0)                         as best,
  coalesce(min(r.net), 0)                         as worst,
  max(r.ended_at)                                 as last_played
from public.group_players gp
left join (
  select gr.*, g.ended_at
  from public.game_results gr join public.games g on g.id = gr.game_id
  where g.deleted_at is null
) r on r.player_id = gp.id
group by gp.id;


-- ---------------------------------------------------------------- personal stats (across all my groups)
-- Rows for every group player I've marked as "this is me".
create or replace view public.my_stats with (security_invoker = true) as
select
  gp.group_id,
  g.name                                          as group_name,
  gp.id                                           as player_id,
  gp.name,
  gp.avatar,
  count(r.game_id)::int                           as games,
  coalesce(sum(r.net), 0)                         as net,
  coalesce(sum(r.buy_in), 0)                      as total_buy_in,
  (count(*) filter (where r.net > 0))::int        as wins,
  coalesce(max(r.net), 0)                         as best,
  coalesce(min(r.net), 0)                         as worst,
  max(r.ended_at)                                 as last_played
from public.group_players gp
join public.groups g on g.id = gp.group_id
left join (
  select gr.*, gm.ended_at
  from public.game_results gr join public.games gm on gm.id = gr.game_id
  where gm.deleted_at is null
) r on r.player_id = gp.id
where gp.claimed_by = auth.uid()
group by gp.id, g.name;

-- My night-by-night results (for trends / streaks), newest first.
create or replace view public.my_results with (security_invoker = true) as
select gm.id as game_id, gm.group_id, gm.ended_at, gm.currency, gr.buy_in, gr.cash_out, gr.net
from public.game_results gr
join public.group_players gp on gp.id = gr.player_id
join public.games gm on gm.id = gr.game_id
where gp.claimed_by = auth.uid() and gm.deleted_at is null;

-- ---------------------------------------------------------------- RPCs: groups
create or replace function public.create_group(p_name text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g groups; code text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  loop
    code := random_code(6);
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;
  insert into groups (name, invite_code, created_by) values (trim(p_name), code, auth.uid()) returning * into g;
  insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'admin');
  return g;
end $$;

create or replace function public.join_group(p_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into g from groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'invalid code' using errcode = 'P0002'; end if;
  insert into group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  return g;
end $$;

-- ---------------------------------------------------------------- RPCs: games
-- p = { id, group_id, started_at, ended_at, chips_per_unit, currency,
--       results:     [{ key, name, avatar, buy_in, cash_out, net }],
--       settlements: [{ from_key, to_key, amount }] }
-- Idempotent: sending the same game twice is a no-op.
create or replace function public.record_game(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  gid uuid := (p ->> 'group_id')::uuid;
  existing games;
  r jsonb; s jsonb;
  ids jsonb := '{}'::jsonb;
  pid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not is_member(gid) then raise exception 'not a member' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p -> 'results', '[]')) = 0 then raise exception 'empty game'; end if;

  select * into existing from games where id = p ->> 'id';
  if found then
    if existing.group_id <> gid then raise exception 'game id belongs to another group' using errcode = '23505'; end if;
    return existing.id;                       -- already synced
  end if;

  insert into games (id, group_id, started_at, ended_at, chips_per_unit, currency, recorded_by)
  values (p ->> 'id', gid, (p ->> 'started_at')::timestamptz, (p ->> 'ended_at')::timestamptz,
          coalesce((p ->> 'chips_per_unit')::numeric, 1), coalesce(p ->> 'currency', '₪'), auth.uid());

  for r in select * from jsonb_array_elements(p -> 'results') loop
    insert into group_players (group_id, name, avatar)
    values (gid, trim(r ->> 'name'), coalesce((r ->> 'avatar')::int, 0))
    on conflict (group_id, lower(name)) do update set avatar = group_players.avatar
    returning id into pid;
    ids := ids || jsonb_build_object(r ->> 'key', pid);
    insert into game_results (game_id, player_id, buy_in, cash_out, net)
    values (p ->> 'id', pid, (r ->> 'buy_in')::numeric, (r ->> 'cash_out')::numeric, (r ->> 'net')::numeric);
  end loop;

  for s in select * from jsonb_array_elements(coalesce(p -> 'settlements', '[]')) loop
    insert into settlements (game_id, from_player, to_player, amount)
    values (p ->> 'id', (ids ->> (s ->> 'from_key'))::uuid, (ids ->> (s ->> 'to_key'))::uuid, (s ->> 'amount')::numeric);
  end loop;

  return p ->> 'id';
end $$;

create or replace function public.delete_game(p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_id;
  if not found then return; end if;
  if not (g.recorded_by = auth.uid() or is_admin(g.group_id)) then
    raise exception 'only the recorder or an admin can delete' using errcode = '42501';
  end if;
  update games set deleted_at = now(), updated_at = now() where id = p_id;
end $$;

-- A signed-in member says "this player is me" (one player per user per group).
create or replace function public.claim_player(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select group_id into gid from group_players where id = p_player;
  if gid is null or not is_member(gid) then raise exception 'not a member' using errcode = '42501'; end if;
  if exists (select 1 from group_players where id = p_player and claimed_by is not null and claimed_by <> auth.uid()) then
    raise exception 'already claimed' using errcode = '23505';
  end if;
  update group_players set claimed_by = null where group_id = gid and claimed_by = auth.uid();
  update group_players set claimed_by = auth.uid() where id = p_player;
end $$;

-- ---------------------------------------------------------------- RPCs: live view-only link
-- Anyone may create one (the game host may not be signed in). Abuse limits:
-- snapshot size cap, and links older than 2 days are cleaned up / unreadable.
create or replace function public.create_live_game(p_snapshot jsonb, p_group uuid default null)
returns table (id uuid, view_token text, write_key text)
language plpgsql security definer set search_path = public as $$
declare row live_games;
begin
  if octet_length(p_snapshot::text) > 20000 then raise exception 'snapshot too large'; end if;
  if p_group is not null and not is_member(p_group) then p_group := null; end if;
  delete from live_games where live_games.updated_at < now() - interval '2 days';
  insert into live_games (view_token, write_key, group_id, snapshot)
  values (random_code(10), md5(random()::text || clock_timestamp()::text) || md5(random()::text), p_group, p_snapshot)
  returning * into row;
  return query select row.id, row.view_token, row.write_key;
end $$;

create or replace function public.update_live_game(p_id uuid, p_key text, p_snapshot jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if octet_length(p_snapshot::text) > 20000 then raise exception 'snapshot too large'; end if;
  update live_games set snapshot = p_snapshot, updated_at = now() where id = p_id and write_key = p_key;
  return found;
end $$;

create or replace function public.get_live_game(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'snapshot', l.snapshot,
    'updated_at', l.updated_at,
    'group', case when g.id is null then null else jsonb_build_object('name', g.name, 'invite_code', g.invite_code) end)
  from live_games l left join groups g on g.id = l.group_id
  where l.view_token = p_token and l.updated_at > now() - interval '2 days';
$$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.create_group(text), public.join_group(text), public.record_game(jsonb),
  public.delete_game(text), public.claim_player(uuid) from public, anon;
grant execute on function public.create_group(text), public.join_group(text), public.record_game(jsonb),
  public.delete_game(text), public.claim_player(uuid) to authenticated;
grant execute on function public.create_live_game(jsonb, uuid), public.update_live_game(uuid, text, jsonb),
  public.get_live_game(text) to anon, authenticated;
grant select on public.group_leaderboard, public.my_stats, public.my_results to authenticated;
