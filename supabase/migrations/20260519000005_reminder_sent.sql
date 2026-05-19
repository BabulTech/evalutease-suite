-- Track whether the 5-minute reminder email has been sent for scheduled sessions.
ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
