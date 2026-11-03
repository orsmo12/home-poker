-- =============================================================================
-- Home Poker — migration 002: tables (felt colour), personal avatar & glow colour, active-game backup
-- Run once in Supabase → SQL Editor, after schema.sql. Safe to re-run.
-- The app keeps working before this runs (it just can't sync felt / glow colours yet).
-- =============================================================================

-- A "group" is now shown in the app as a TABLE; each table has its own felt colour.
alter table public.groups   add column if not exists felt  text not null default 'green'
  check (felt in ('green', 'blue', 'red', 'black'));

-- Each player picks a character + a glow colour, shown to everyone at their tables.
alter table public.profiles add column if not exists color text not null default ''
  check (color = '' or color ~ '^#[0-9a-fA-F]{6}$');

-- Character + glow of the signed-in players behind each table's players ("this is me" claims).
create or replace view public.table_profiles with (security_invoker = true) as
select gp.group_id, gp.id as player_id, gp.name, gp.claimed_by, p.display_name, p.avatar, p.color
from public.group_players gp
join public.profiles p on p.id = gp.claimed_by;

grant select on public.table_profiles to authenticated;

-- Backup of the game that is still being played (one row per signed-in host). If the phone dies
-- or the browser clears its data mid-game, the host can restore the night from any device.
create table if not exists public.active_games (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  game_id    text not null,
  game       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.active_games enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'active_games' and policyname = 'active_games_own') then
    create policy active_games_own on public.active_games for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
grant select, insert, update, delete on public.active_games to authenticated;
