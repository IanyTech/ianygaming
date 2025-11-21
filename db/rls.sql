-- ========== rls.sql ==========
-- Abilita RLS su tutte le tabelle interessate
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.carts enable row level security;
alter table public.reviews enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.orders enable row level security;
alter table public.user_settings enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

-- PROFILES: proprietario può leggere/aggiornare/creare solo se id = auth.uid()
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_upsert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ( id = auth.uid() );

create policy profiles_upsert_own
  on public.profiles for insert
  to authenticated
  with check ( id = auth.uid() );

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ( id = auth.uid() )
  with check ( id = auth.uid() );

-- FAVORITES: CRUD solo proprietario
drop policy if exists favorites_crud_own on public.favorites;

create policy favorites_crud_own
  on public.favorites
  for all
  to authenticated
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

-- COUPONS: sola lettura per tutti (definizione pubblica), nessuna scrittura dal client
drop policy if exists coupons_select_public on public.coupons;
create policy coupons_select_public
  on public.coupons
  for select
  to anon, authenticated
  using ( active = true );

-- COUPON REDEMPTIONS: inserimento/lettura solo per l'utente autenticato
drop policy if exists coupon_redemptions_crud_own on public.coupon_redemptions;
create policy coupon_redemptions_crud_own
  on public.coupon_redemptions
  for all
  to authenticated
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

-- CARTS: CRUD solo proprietario
drop policy if exists carts_crud_own on public.carts;

create policy carts_crud_own
  on public.carts
  for all
  to authenticated
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

-- REVIEWS: select pubblica, insert autenticato (propria riga)
drop policy if exists reviews_select_public on public.reviews;
drop policy if exists reviews_insert_self on public.reviews;
drop policy if exists reviews_delete_own on public.reviews;
drop policy if exists reviews_delete_admin on public.reviews;

create policy reviews_select_public
  on public.reviews
  for select
  to anon, authenticated
  using ( true );

create policy reviews_insert_self
  on public.reviews
  for insert
  to authenticated
  with check ( user_id = auth.uid() );

-- Consenti agli autori di cancellare le proprie recensioni
create policy reviews_delete_own
  on public.reviews
  for delete
  to authenticated
  using ( user_id = auth.uid() );

-- Consenti agli admin di cancellare qualsiasi recensione
-- Richiede tabella public.admin_emails(email citext primary key)
create policy reviews_delete_admin
  on public.reviews
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.admin_emails a
      where lower(a.email::text) = lower(coalesce((auth.jwt() ->> 'email')::text, ''))
    )
  );

-- NEWSLETTER: consenti solo insert a chiunque; nessuna select dall’app
drop policy if exists newsletter_insert_any on public.newsletter_subscribers;

create policy newsletter_insert_any
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check ( true );

-- CONTACT MESSAGES: consenti solo insert a chiunque; nessuna select dall’app
drop policy if exists contact_insert_any on public.contact_messages;

create policy contact_insert_any
  on public.contact_messages
  for insert
  to anon, authenticated
  with check ( true );

-- ORDERS: insert chiunque (guest possibile), select/update solo proprietario autenticato
drop policy if exists orders_insert_any on public.orders;
drop policy if exists orders_select_own on public.orders;
drop policy if exists orders_update_own on public.orders;

create policy orders_insert_any
  on public.orders
  for insert
  to anon, authenticated
  with check ( true );

create policy orders_select_own
  on public.orders
  for select
  to authenticated
  using ( user_id = auth.uid() );

create policy orders_update_own
  on public.orders
  for update
  to authenticated
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

-- USER SETTINGS: CRUD solo proprietario
drop policy if exists settings_crud_own on public.user_settings;

create policy settings_crud_own
  on public.user_settings
  for all
  to authenticated
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );
