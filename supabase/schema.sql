create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id text not null,
  title text not null,
  schedule jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  sort_order integer not null default 0,
  primary key (user_id, habit_id)
);

create table if not exists public.habit_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id text not null,
  log_date date not null,
  status text not null check (status in ('yes', 'no', 'skip')),
  note text not null default '',
  frozen boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, habit_id, log_date)
);

create table if not exists public.workouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text not null,
  title text not null,
  schedule_days smallint[] not null default '{}',
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, routine_id)
);

create table if not exists public.workout_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  session_date date not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, session_id)
);

create table if not exists public.workout_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id text not null,
  post_date date not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, post_id)
);

create table if not exists public.calendar_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  event_date date not null,
  title text not null,
  event_type text not null,
  event_time time not null default '09:00',
  recurrence jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, event_id)
);

create table if not exists public.goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  title text not null,
  due_date date,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, entry_id)
);

create table if not exists public.journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  entry_date date,
  kind text not null default 'reflection',
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, entry_id)
);

create table if not exists public.prayer_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  entry_date date,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, entry_id)
);

create table if not exists public.prayer_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  entry_date date,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, entry_id)
);

create table if not exists public.scripture_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  reference text not null,
  due_date date,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, card_id)
);

create table if not exists public.gratitude_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  entry_date date,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, entry_id)
);

create table if not exists public.focus_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  session_date date not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, session_id)
);

create table if not exists public.focus_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  title text not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, task_id)
);

create table if not exists public.focus_garden (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  entry_date date not null,
  outcome text not null check (outcome in ('grown', 'withered')),
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, entry_id)
);

create table if not exists public.water_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  amount integer not null default 0 check (amount >= 0),
  primary key (user_id, log_date)
);

create table if not exists public.prayer_time_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  minutes integer not null default 0 check (minutes >= 0),
  primary key (user_id, log_date)
);

create table if not exists public.future_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  kind text not null check (kind in ('milestone', 'vision')),
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, entry_id)
);

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_posts enable row level security;
alter table public.calendar_events enable row level security;
alter table public.goals enable row level security;
alter table public.journal_entries enable row level security;
alter table public.prayer_entries enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.scripture_cards enable row level security;
alter table public.gratitude_entries enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.focus_tasks enable row level security;
alter table public.focus_garden enable row level security;
alter table public.water_logs enable row level security;
alter table public.prayer_time_logs enable row level security;
alter table public.future_items enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'settings', 'habits', 'habit_logs', 'workouts', 'workout_sessions', 'workout_posts',
    'calendar_events', 'goals', 'journal_entries', 'prayer_entries', 'prayer_requests', 'scripture_cards',
    'gratitude_entries', 'focus_sessions', 'focus_tasks', 'focus_garden', 'water_logs', 'prayer_time_logs', 'future_items'
  ] loop
    execute format('drop policy if exists owner_all on public.%I', table_name);
    execute format('create policy owner_all on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end;
$$;
