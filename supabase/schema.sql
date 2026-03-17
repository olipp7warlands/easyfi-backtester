-- EasyFi Backtester — Supabase Schema
-- Run this in the Supabase SQL editor after creating your project.

-- Enable RLS on auth.users (already enabled by default)

-- ── Profiles ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Saved Strategies ──────────────────────────────────────────────────────────
create table if not exists public.strategies (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  type        text not null,
  color       text not null,
  range_pct   numeric not null,
  abs_lo      numeric,
  abs_hi      numeric,
  compounding boolean default false not null,
  created_at  timestamptz default now() not null
);
alter table public.strategies enable row level security;

create policy "Users manage their own strategies"
  on public.strategies for all
  using (auth.uid() = user_id);

-- ── Saved Backtests ───────────────────────────────────────────────────────────
create table if not exists public.backtests (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null default 'Backtest',
  symbol      text not null,
  network     text not null,
  days        integer not null,
  fee_tier    numeric not null,
  capital     numeric not null,
  daily_vol   numeric not null,
  tvl         numeric not null,
  gas_cost    numeric not null,
  slippage    numeric not null,
  rebal_hours numeric not null,
  entry_price numeric,
  current_price numeric,
  created_at  timestamptz default now() not null
);
alter table public.backtests enable row level security;

create policy "Users manage their own backtests"
  on public.backtests for all
  using (auth.uid() = user_id);

-- ── Backtest Results ──────────────────────────────────────────────────────────
create table if not exists public.backtest_results (
  id                uuid default gen_random_uuid() primary key,
  backtest_id       uuid references public.backtests(id) on delete cascade not null,
  strategy_name     text not null,
  strategy_type     text not null,
  strategy_color    text not null,
  annual_apr        numeric,
  total_fees        numeric,
  total_il          numeric,
  final_value       numeric,
  rebal_count       integer,
  pct_in_range      numeric,
  total_rebal_cost  numeric,
  net_pnl           numeric,
  created_at        timestamptz default now() not null
);
alter table public.backtest_results enable row level security;

create policy "Users view their own backtest results"
  on public.backtest_results for all
  using (
    exists (
      select 1 from public.backtests b
      where b.id = backtest_results.backtest_id
        and b.user_id = auth.uid()
    )
  );
