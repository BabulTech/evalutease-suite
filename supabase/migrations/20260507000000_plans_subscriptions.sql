-- ============================================================
-- Plans, Subscriptions & Payment History
-- ============================================================

-- ── Plans (master catalogue, managed by admins) ─────────────
create table if not exists public.plans (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,           -- free | pro | enterprise
  description             text,
  price_monthly           numeric(10,2) not null default 0,
  price_yearly            numeric(10,2) not null default 0,
  limits                  jsonb not null default '{}'::jsonb,
  features                jsonb not null default '[]'::jsonb,
  is_active               boolean not null default true,
  sort_order              int not null default 0,
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── User Subscriptions ───────────────────────────────────────
create table if not exists public.user_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  plan_id                  uuid not null references public.plans(id),
  status                   text not null default 'active'
                             check (status in ('active','trialing','canceled','past_due','incomplete')),
  billing_cycle            text not null default 'monthly'
                             check (billing_cycle in ('monthly','yearly')),
  stripe_customer_id       text,
  stripe_subscription_id   text,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  trial_end                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique(user_id)          -- one active subscription per user
);

-- ── Payment History ──────────────────────────────────────────
create table if not exists public.payment_history (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  subscription_id           uuid references public.user_subscriptions(id),
  plan_id                   uuid references public.plans(id),
  amount_cents              int not null,
  currency                  text not null default 'usd',
  status                    text not null default 'paid'
                              check (status in ('paid','failed','refunded','pending')),
  stripe_payment_intent_id  text,
  description               text,
  paid_at                   timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists user_subscriptions_user_id_idx on public.user_subscriptions(user_id);
create index if not exists payment_history_user_id_idx on public.payment_history(user_id);
create index if not exists payment_history_paid_at_idx on public.payment_history(paid_at desc);

-- ── Updated-at trigger ───────────────────────────────────────
create trigger touch_plans_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

create trigger touch_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.payment_history enable row level security;

-- Plans: anyone authenticated can read
create policy "Anyone can view plans"
  on public.plans for select
  using (true);

-- Plans: only admins can write
create policy "Admins manage plans"
  on public.plans for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Subscriptions: users see their own; admins see all
create policy "Users view own subscription"
  on public.user_subscriptions for select
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage subscriptions"
  on public.user_subscriptions for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Payment history: users see their own; admins see all
create policy "Users view own payments"
  on public.payment_history for select
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage payments"
  on public.payment_history for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── Seed default plans ────────────────────────────────────────
insert into public.plans (name, slug, description, price_monthly, price_yearly, sort_order, limits, features) values
(
  'Free',
  'free',
  'Perfect for individuals and small classrooms just getting started.',
  0, 0, 0,
  '{"quizzes_per_day":5,"ai_calls_per_day":3,"participants_per_session":30,"question_bank":100,"sessions_total":20}',
  '["5 quizzes per day","3 AI question generations/day","Up to 30 participants per session","100 question bank","Basic analytics","Email support"]'
),
(
  'Pro',
  'pro',
  'For active educators who need more power and customisation.',
  12.00, 99.00, 1,
  '{"quizzes_per_day":50,"ai_calls_per_day":20,"participants_per_session":200,"question_bank":2000,"sessions_total":-1}',
  '["50 quizzes per day","20 AI question generations/day","Up to 200 participants per session","2 000 question bank","Advanced analytics & reports","Custom lobby & completion messages","Speed bonus & scoring rules","Priority email support"]'
),
(
  'Enterprise',
  'enterprise',
  'Unlimited capacity for large institutions and training organisations.',
  39.00, 319.00, 2,
  '{"quizzes_per_day":-1,"ai_calls_per_day":-1,"participants_per_session":-1,"question_bank":-1,"sessions_total":-1}',
  '["Unlimited quizzes","Unlimited AI generations","Unlimited participants","Unlimited question bank","White-label branding","API access","Dedicated account manager","SLA & compliance docs","Custom Stripe billing"]'
)
on conflict (slug) do nothing;

-- ── Helper: get current plan for a user ───────────────────────
create or replace function public.get_user_plan(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(pl)
  from public.user_subscriptions us
  join public.plans pl on pl.id = us.plan_id
  where us.user_id = p_user_id
    and us.status in ('active','trialing')
  limit 1;
$$;

-- ── Helper: assign free plan on signup ────────────────────────
create or replace function public.assign_free_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  select id into v_plan_id from public.plans where slug = 'free' limit 1;
  if v_plan_id is not null then
    insert into public.user_subscriptions(user_id, plan_id, status)
    values (new.id, v_plan_id, 'active')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Fire after user profile is created (profiles are created by existing trigger first)
create trigger assign_free_plan_on_signup
  after insert on public.profiles
  for each row execute function public.assign_free_plan();
