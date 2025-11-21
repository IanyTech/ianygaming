-- ========== schema.sql ==========
-- Estensioni utili
create extension if not exists pgcrypto;
create extension if not exists citext;

-- PROFILES -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  avatar_url text,
  newsletter boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FAVORITES ------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists idx_favorites_user on public.favorites (user_id);
create index if not exists idx_favorites_product on public.favorites (product_id);

-- CARTS ----------------------------------------------------------------
create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists idx_carts_user on public.carts (user_id);

-- REVIEWS --------------------------------------------------------------
create table if not exists public.reviews (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  rating int not null check (rating between 1 and 5),
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_reviews_product on public.reviews (product_id);
create index if not exists idx_reviews_user on public.reviews (user_id);
create index if not exists idx_reviews_product_created on public.reviews (product_id, created_at desc);

-- ADMINS -----------------------------------------------------------------
create table if not exists public.admin_emails (
  email citext primary key
);

-- NEWSLETTER SUBSCRIBERS ----------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  source text,
  created_at timestamptz not null default now()
);

-- CONTACT MESSAGES -----------------------------------------------------
create table if not exists public.contact_messages (
  id bigserial primary key,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);

-- ORDERS ---------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  items jsonb not null,
  total_amount numeric(12,2) not null,
  currency text default 'EUR',
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_user on public.orders (user_id);
create index if not exists idx_orders_status on public.orders (status);

-- USER SETTINGS --------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- COUPONS ---------------------------------------------------------------
create table if not exists public.coupons (
  code text primary key,
  type text not null check (type in ('percent','fixed','ship')),
  value numeric(12,2), -- null for 'ship'
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_coupons_active on public.coupons (active);
create index if not exists idx_coupons_expires on public.coupons (expires_at);

-- COUPON REDEMPTIONS ----------------------------------------------------
create table if not exists public.coupon_redemptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.coupons(code) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  redeemed_at timestamptz not null default now()
);
create unique index if not exists uq_coupon_once_per_user on public.coupon_redemptions (user_id, code);
