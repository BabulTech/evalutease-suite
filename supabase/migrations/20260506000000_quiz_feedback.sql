-- Quiz feedback submitted by participants after completing a quiz session.
-- One row per participant submission per session.

create table if not exists public.quiz_feedback (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.quiz_sessions(id) on delete cascade,
  participant_name  text not null default 'Anonymous',
  participant_email text,
  rating            smallint not null check (rating between 1 and 5),
  comment           text,
  submitted_at      timestamptz not null default now()
);

-- Index so the host can quickly fetch all feedback for their sessions
create index if not exists quiz_feedback_session_id_idx
  on public.quiz_feedback(session_id);

-- RLS: anyone can insert feedback (participants are not authenticated)
alter table public.quiz_feedback enable row level security;

-- Public insert — participants submit without auth
create policy "Anyone can submit quiz feedback"
  on public.quiz_feedback
  for insert
  with check (true);

-- Only the session owner can read their quiz feedback
create policy "Host can read own quiz feedback"
  on public.quiz_feedback
  for select
  using (
    exists (
      select 1
      from public.quiz_sessions s
      where s.id = quiz_feedback.session_id
        and s.owner_id = auth.uid()
    )
  );
