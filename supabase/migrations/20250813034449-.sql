-- Re-run migration without IF NOT EXISTS on policies
create extension if not exists pgcrypto with schema public;

-- USERS TABLE
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  invited boolean not null default false,
  full_name text,
  shipping_address jsonb,
  order_submitted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Policies for users
drop policy if exists "Users can view their own profile if invited and allowed domain" on public.users;
create policy "Users can view their own profile if invited and allowed domain"
  on public.users for select to authenticated
  using (
    auth.uid() = id
    and invited = true
    and (
      lower(((current_setting('request.jwt.claims', true))::jsonb ->> 'email')) like '%@alteryx.com'
      or lower(((current_setting('request.jwt.claims', true))::jsonb ->> 'email')) like '%@whitestonebranding.com'
    )
  );

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ORDERS TABLE
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date_submitted timestamptz not null default now(),
  unique (user_id)
);

alter table public.orders enable row level security;

-- Policies for orders
drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders"
  on public.orders for select to authenticated
  using (auth.uid() = user_id);

-- INVENTORY TABLE
create table if not exists public.inventory (
  product_id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  quantity_available integer not null default 0 check (quantity_available >= 0)
);

alter table public.inventory enable row level security;

-- Policies for inventory
drop policy if exists "Authenticated users can read inventory" on public.inventory;
create policy "Authenticated users can read inventory"
  on public.inventory for select to authenticated
  using (true);

-- TRIGGER: Insert a users row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, invited)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null), false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();