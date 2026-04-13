-- Seed data for local development
-- Runs automatically on `npx supabase db reset`

-- Create a test admin user in auth
-- GoTrue scans all varchar columns and crashes on NULLs, so set them all to ''
insert into auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone, phone_change, phone_change_token,
  reauthentication_token,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin@localhost',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '', '',
  '', '', '',
  null, '', '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Court Admin"}'::jsonb
);

insert into auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'admin@localhost', 'email',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin@localhost"}'::jsonb,
  now(), now(), now()
);

-- The trigger auto-creates a profile, but update it to be a complete admin
update public.profiles
set display_name = 'Court Admin',
    ntrp_rating = 4.0,
    preferred_match_type = 'both',
    is_admin = true
where id = '00000000-0000-0000-0000-000000000001';

-- Create a second test player
insert into auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone, phone_change, phone_change_token,
  reauthentication_token,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'player2@localhost',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '', '',
  '', '', '',
  null, '', '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Test Player"}'::jsonb
);

insert into auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'player2@localhost', 'email',
  '{"sub":"00000000-0000-0000-0000-000000000002","email":"player2@localhost"}'::jsonb,
  now(), now(), now()
);

update public.profiles
set display_name = 'Test Player',
    ntrp_rating = 3.5,
    preferred_match_type = 'singles'
where id = '00000000-0000-0000-0000-000000000002';

-- Create a court group for the local courts
insert into court_groups (id, name, description, timezone, created_by)
values (
  '10000000-0000-0000-0000-000000000001',
  'Neighborhood Tennis Courts',
  'The 4 public tennis courts a block away. Open dawn to dusk, first come first served.',
  'America/New_York',
  '00000000-0000-0000-0000-000000000001'
);

-- Create 4 individual courts
insert into courts (court_group_id, name, sport, surface_type, is_lit, notes) values
  ('10000000-0000-0000-0000-000000000001', 'Court 1', 'tennis', 'hard', false, null),
  ('10000000-0000-0000-0000-000000000001', 'Court 2', 'tennis', 'hard', false, null),
  ('10000000-0000-0000-0000-000000000001', 'Court 3', 'tennis', 'hard', false, null),
  ('10000000-0000-0000-0000-000000000001', 'Court 4', 'tennis', 'hard', false, null);

-- Assign both test users to this court group
update public.profiles
set court_group_id = '10000000-0000-0000-0000-000000000001'
where id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
