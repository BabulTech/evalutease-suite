-- Teacher → Admin app feedback (bug reports, feature requests, suggestions)
create table if not exists public.app_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null default 'improvement'
                check (type in ('bug','feature','improvement','other')),
  title       text not null,
  body        text not null,
  status      text not null default 'open'
                check (status in ('open','in_review','resolved','wont_fix')),
  priority    text not null default 'medium'
                check (priority in ('low','medium','high','critical')),
  admin_reply text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists app_feedback_user_id_idx on public.app_feedback(user_id);
create index if not exists app_feedback_status_idx  on public.app_feedback(status);

create trigger touch_app_feedback_updated_at
  before update on public.app_feedback
  for each row execute function public.touch_updated_at();

alter table public.app_feedback enable row level security;

-- Teachers can insert and read their own submissions
create policy "Users manage own feedback"
  on public.app_feedback for all
  using  (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
