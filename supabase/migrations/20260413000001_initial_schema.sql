-- Matchmaker: Initial Schema
-- Tennis matchmaking app — all tables, functions, RLS policies, and indexes.

-- gen_random_uuid() is built into Postgres 13+, no extension needed

-- ============================================================
-- Court Groups (neighborhoods)
-- ============================================================
create table court_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  location_lat double precision,
  location_lng double precision,
  timezone text not null default 'America/New_York',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Courts
-- ============================================================
create table courts (
  id uuid primary key default gen_random_uuid(),
  court_group_id uuid not null references court_groups(id) on delete cascade,
  name text not null,
  sport text not null default 'tennis',
  surface_type text,
  is_lit boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Player Profiles (extends auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  ntrp_rating numeric(2,1) check (ntrp_rating >= 1.0 and ntrp_rating <= 7.0),
  preferred_match_type text not null default 'both'
    check (preferred_match_type in ('singles', 'doubles', 'both')),
  notification_email boolean not null default true,
  notification_in_app boolean not null default true,
  court_group_id uuid references court_groups(id) on delete set null,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Player')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update updated_at on profile changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- Availability
-- ============================================================
create table availability (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  court_group_id uuid not null references court_groups(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  match_type text not null default 'both'
    check (match_type in ('singles', 'doubles', 'both')),
  status text not null default 'open'
    check (status in ('open', 'matched', 'expired', 'cancelled')),
  notes text,
  recurrence_rule text,
  created_at timestamptz not null default now(),
  constraint valid_time_range check (end_time > start_time)
);

-- ============================================================
-- Matches
-- ============================================================
create table matches (
  id uuid primary key default gen_random_uuid(),
  court_group_id uuid not null references court_groups(id) on delete cascade,
  match_type text not null check (match_type in ('singles', 'doubles')),
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'completed', 'cancelled')),
  court_id uuid references courts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Match Players (junction table)
-- ============================================================
create table match_players (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  response text not null default 'pending'
    check (response in ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  primary key (match_id, player_id)
);

-- ============================================================
-- Notifications
-- ============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in (
    'match_proposed', 'match_confirmed', 'match_cancelled', 'match_declined', 'system'
  )),
  title text not null,
  body text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helper function for match_players RLS
-- (SECURITY DEFINER avoids self-referencing RLS recursion)
-- ============================================================
create or replace function get_my_match_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select match_id from match_players where player_id = auth.uid();
$$;

-- ============================================================
-- Indexes
-- ============================================================
create index idx_court_groups_created_by on court_groups (created_by);
create index idx_courts_court_group_id on courts (court_group_id);
create index idx_profiles_court_group_id on profiles (court_group_id);
create index idx_availability_player_id on availability (player_id);
create index idx_availability_court_group_id on availability (court_group_id);
create index idx_availability_lookup
  on availability (court_group_id, date, status)
  where status = 'open';
create index idx_matches_court_id on matches (court_id);
create index idx_matches_court_group_id on matches (court_group_id);
create index idx_matches_upcoming
  on matches (court_group_id, date, status)
  where status in ('proposed', 'confirmed');
create index idx_match_players_player_id on match_players (player_id);
create index idx_notifications_user
  on notifications (user_id, read, created_at desc);

-- ============================================================
-- Row-Level Security Policies
-- ============================================================

-- Court Groups: anyone can read, only admins can modify
alter table court_groups enable row level security;

create policy "court_groups_select" on court_groups
  for select using (true);

create policy "court_groups_insert" on court_groups
  for insert with check (
    exists (select 1 from profiles where id = (select auth.uid()) and is_admin = true)
  );

create policy "court_groups_update" on court_groups
  for update using (
    exists (select 1 from profiles where id = (select auth.uid()) and is_admin = true)
  );

create policy "court_groups_delete" on court_groups
  for delete using (
    exists (select 1 from profiles where id = (select auth.uid()) and is_admin = true)
  );

-- Courts: anyone can read, only admins can modify
alter table courts enable row level security;

create policy "courts_select" on courts
  for select using (true);

create policy "courts_insert" on courts
  for insert with check (
    exists (select 1 from profiles where id = (select auth.uid()) and is_admin = true)
  );

create policy "courts_update" on courts
  for update using (
    exists (select 1 from profiles where id = (select auth.uid()) and is_admin = true)
  );

create policy "courts_delete" on courts
  for delete using (
    exists (select 1 from profiles where id = (select auth.uid()) and is_admin = true)
  );

-- Profiles: users can read all, update own profile (admins can update any)
alter table profiles enable row level security;

create policy "profiles_select" on profiles
  for select using (true);

create policy "profiles_insert" on profiles
  for insert with check (id = (select auth.uid()));

create policy "profiles_update" on profiles
  for update using (
    id = (select auth.uid())
    or exists (select 1 from profiles where id = (select auth.uid()) and is_admin = true)
  );

-- Availability: users can see all, manage their own
alter table availability enable row level security;

create policy "availability_select" on availability
  for select using (true);

create policy "availability_insert" on availability
  for insert with check (player_id = (select auth.uid()));

create policy "availability_update" on availability
  for update using (player_id = (select auth.uid()));

create policy "availability_delete" on availability
  for delete using (player_id = (select auth.uid()));

-- Matches: players can see and update matches they're part of
alter table matches enable row level security;

create policy "matches_select" on matches
  for select using (
    exists (
      select 1 from match_players
      where match_players.match_id = matches.id
      and match_players.player_id = (select auth.uid())
    )
  );

create policy "matches_update" on matches
  for update using (
    exists (
      select 1 from match_players
      where match_players.match_id = matches.id
      and match_players.player_id = (select auth.uid())
    )
  );

-- Match Players: players can see all participants in their matches, update own response
alter table match_players enable row level security;

create policy "match_players_select" on match_players
  for select using (match_id in (select get_my_match_ids()));

create policy "match_players_update" on match_players
  for update using (player_id = (select auth.uid()));

-- Notifications: users can only see and manage their own
alter table notifications enable row level security;

create policy "notifications_select" on notifications
  for select using (user_id = (select auth.uid()));

create policy "notifications_update" on notifications
  for update using (user_id = (select auth.uid()));

-- ============================================================
-- Matchmaking Function
-- ============================================================
create or replace function run_matchmaking()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  match_count integer := 0;
  avail_a record;
  avail_b record;
  new_match_id uuid;
  overlap_start time;
  overlap_end time;
  min_overlap interval := interval '30 minutes';
begin
  for avail_a in
    select a.*, p.ntrp_rating, p.preferred_match_type as player_pref
    from availability a
    join profiles p on p.id = a.player_id
    where a.status = 'open'
      and a.date >= current_date
      and p.is_banned = false
    order by a.date, a.start_time
  loop
    if (select status from availability where id = avail_a.id) != 'open' then
      continue;
    end if;

    for avail_b in
      select a.*, p.ntrp_rating, p.preferred_match_type as player_pref
      from availability a
      join profiles p on p.id = a.player_id
      where a.status = 'open'
        and a.court_group_id = avail_a.court_group_id
        and a.date = avail_a.date
        and a.player_id != avail_a.player_id
        and p.is_banned = false
        and abs(p.ntrp_rating - avail_a.ntrp_rating) <= 0.5
        and (
          avail_a.match_type = 'both'
          or a.match_type = 'both'
          or avail_a.match_type = a.match_type
        )
        and a.start_time < avail_a.end_time
        and a.end_time > avail_a.start_time
      order by abs(p.ntrp_rating - avail_a.ntrp_rating), a.start_time
      limit 1
    loop
      if (select status from availability where id = avail_b.id) != 'open' then
        continue;
      end if;

      overlap_start := greatest(avail_a.start_time, avail_b.start_time);
      overlap_end := least(avail_a.end_time, avail_b.end_time);

      if (overlap_end - overlap_start) < min_overlap then
        continue;
      end if;

      insert into matches (court_group_id, match_type, date, start_time, end_time, status)
      values (
        avail_a.court_group_id,
        'singles',
        avail_a.date,
        overlap_start,
        overlap_end,
        'proposed'
      )
      returning id into new_match_id;

      insert into match_players (match_id, player_id, response)
      values
        (new_match_id, avail_a.player_id, 'pending'),
        (new_match_id, avail_b.player_id, 'pending');

      update availability set status = 'matched' where id = avail_a.id;
      update availability set status = 'matched' where id = avail_b.id;

      insert into notifications (user_id, type, title, body, data)
      values
        (avail_a.player_id, 'match_proposed', 'New match proposal! 🎾',
         'You have a new match proposal for ' || to_char(avail_a.date, 'Mon DD') || ' at ' || to_char(overlap_start, 'HH12:MI AM'),
         jsonb_build_object('match_id', new_match_id)),
        (avail_b.player_id, 'match_proposed', 'New match proposal! 🎾',
         'You have a new match proposal for ' || to_char(avail_a.date, 'Mon DD') || ' at ' || to_char(overlap_start, 'HH12:MI AM'),
         jsonb_build_object('match_id', new_match_id));

      match_count := match_count + 1;
    end loop;
  end loop;

  return match_count;
end;
$$;

grant execute on function run_matchmaking() to authenticated;
grant execute on function run_matchmaking() to service_role;

-- Schedule matchmaking to run every 15 minutes via pg_cron (if available)
-- Uncomment after enabling pg_cron extension in Supabase dashboard:
-- select cron.schedule(
--   'run-matchmaking',
--   '*/15 * * * *',
--   $$ select run_matchmaking(); $$
-- );
