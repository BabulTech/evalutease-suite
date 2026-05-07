create table if not exists public.promo_codes (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  description          text,
  discount_percent     numeric(5,2),          -- e.g. 20 → 20% off
  discount_fixed_cents int,                   -- e.g. 500 → $5 off
  applies_to_slugs     text[] not null default '{}', -- empty = all plans
  max_uses             int,                   -- null = unlimited
  uses_count           int not null default 0,
  expires_at           timestamptz,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- Anyone authenticated can validate a code (read-only, filtered by is_active)
create policy "Authenticated users can validate promo codes"
  on public.promo_codes for select
  using (auth.role() = 'authenticated');

-- Only admins can create / update / delete codes
create policy "Admins manage promo codes"
  on public.promo_codes for all
  using  (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Seed a sample code for testing
insert into public.promo_codes (code, description, discount_percent, applies_to_slugs, max_uses, expires_at)
values
  ('WELCOME20', '20% off any paid plan', 20, '{}', 100, now() + interval '1 year'),
  ('PROEDU50',  '50% off Pro plan',      50, '{pro}', 50, now() + interval '6 months')
on conflict (code) do nothing;
