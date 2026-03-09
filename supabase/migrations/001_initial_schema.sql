-- ============================================================
-- CLOCK IT — Initial Schema Migration
-- ============================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'worker' check (role in ('worker', 'manager')),
  hourly_rate numeric(10, 2) not null default 0,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Locations / Projects
create table public.locations (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Shifts
create table public.shifts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  start_time  timestamptz not null default now(),
  end_time    timestamptz,
  status      text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes       text,
  created_at  timestamptz not null default now()
);

-- Expenses (linked to a shift)
create table public.expenses (
  id          uuid primary key default uuid_generate_v4(),
  shift_id    uuid not null references public.shifts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('transport', 'food', 'parking', 'accommodation', 'other')),
  amount      numeric(10, 2) not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_shifts_user_id on public.shifts(user_id);
create index idx_shifts_status on public.shifts(status);
create index idx_shifts_start_time on public.shifts(start_time);
create index idx_expenses_shift_id on public.expenses(shift_id);
create index idx_expenses_user_id on public.expenses(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.locations enable row level security;
alter table public.shifts    enable row level security;
alter table public.expenses  enable row level security;

-- Helper function: get current user role
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---- PROFILES ----
-- Users can read their own profile; managers can read all
create policy "profiles: user reads own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: manager reads all"
  on public.profiles for select
  using (public.get_my_role() = 'manager');

create policy "profiles: user updates own"
  on public.profiles for update
  using (id = auth.uid());

-- ---- LOCATIONS ----
-- All authenticated users can read active locations
create policy "locations: all authenticated can read"
  on public.locations for select
  using (auth.uid() is not null and is_active = true);

-- Only managers can create/update locations
create policy "locations: manager can insert"
  on public.locations for insert
  with check (public.get_my_role() = 'manager');

create policy "locations: manager can update"
  on public.locations for update
  using (public.get_my_role() = 'manager');

-- ---- SHIFTS ----
-- Workers see only their own; managers see all
create policy "shifts: worker reads own"
  on public.shifts for select
  using (user_id = auth.uid());

create policy "shifts: manager reads all"
  on public.shifts for select
  using (public.get_my_role() = 'manager');

create policy "shifts: worker inserts own"
  on public.shifts for insert
  with check (user_id = auth.uid());

create policy "shifts: worker updates own active shift"
  on public.shifts for update
  using (user_id = auth.uid() and status = 'active')
  with check (user_id = auth.uid());

create policy "shifts: manager updates any"
  on public.shifts for update
  using (public.get_my_role() = 'manager');

-- ---- EXPENSES ----
-- Workers see their own expenses; managers see all
create policy "expenses: worker reads own"
  on public.expenses for select
  using (user_id = auth.uid());

create policy "expenses: manager reads all"
  on public.expenses for select
  using (public.get_my_role() = 'manager');

create policy "expenses: worker inserts own"
  on public.expenses for insert
  with check (user_id = auth.uid());

create policy "expenses: worker deletes own"
  on public.expenses for delete
  using (user_id = auth.uid());

create policy "expenses: manager deletes any"
  on public.expenses for delete
  using (public.get_my_role() = 'manager');

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at on profiles
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- SEED DATA — Demo locations
-- ============================================================
insert into public.locations (name, address) values
  ('HQ Brussels', 'Rue de la Loi 1, 1000 Brussels'),
  ('Antwerp Warehouse', 'Havenstraat 44, 2000 Antwerp'),
  ('Ghent Office', 'Veldstraat 60, 9000 Ghent'),
  ('Remote / Home', null);
