-- ============================================================
-- Quiz session lifecycle audit + host notifications
-- Logs every state change (create / start / pause / resume / close /
-- finalize / delete / scheduled / reminder-sent) into activity_logs
-- and fires a host notification for the loud ones.
-- ============================================================

-- ─── Helper: insert a session-scoped activity row ────────────
CREATE OR REPLACE FUNCTION public._log_session_activity(
  p_action_type   TEXT,
  p_session_id    UUID,
  p_session_title TEXT,
  p_owner_id      UUID,
  p_message       TEXT,
  p_details       JSONB DEFAULT '{}'::jsonb,
  p_risk_score    INTEGER DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor   UUID := COALESCE(auth.uid(), p_owner_id);
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.activity_logs (
    actor_user_id, actor_name, actor_email, plan_owner_id,
    action_type, module, entity_type, entity_id, entity_label,
    message, details, risk_score
  ) VALUES (
    v_actor,
    COALESCE(v_profile.full_name, split_part(COALESCE(v_profile.email, ''), '@', 1), 'System'),
    v_profile.email,
    p_owner_id,
    left(lower(trim(p_action_type)), 50),
    'sessions',
    'quiz_session',
    p_session_id,
    NULLIF(left(trim(p_session_title), 240), ''),
    COALESCE(NULLIF(trim(p_message), ''), 'Session activity'),
    COALESCE(p_details, '{}'::jsonb),
    GREATEST(0, LEAST(100, COALESCE(p_risk_score, 0)))
  );
END;
$$;

-- ─── Trigger function: react to every quiz_sessions write ────
CREATE OR REPLACE FUNCTION public.trg_quiz_session_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action TEXT;
  v_msg    TEXT;
BEGIN
  -- INSERT: new session created
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_session_activity(
      'created', NEW.id, NEW.title, NEW.owner_id,
      'Created quiz session "' || NEW.title || '"',
      jsonb_build_object('status', NEW.status, 'access_code', NEW.access_code),
      5
    );
    RETURN NEW;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' THEN
    PERFORM public._log_session_activity(
      'deleted', OLD.id, OLD.title, OLD.owner_id,
      'Deleted quiz session "' || OLD.title || '"',
      jsonb_build_object('was_status', OLD.status),
      40
    );
    RETURN OLD;
  END IF;

  -- UPDATE: status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'active' AND OLD.status IN ('draft', 'scheduled') THEN
      v_action := 'started';
      v_msg    := 'Started quiz session "' || NEW.title || '"';
      PERFORM public.create_notification(
        NEW.owner_id,
        'Quiz started',
        'Your quiz "' || NEW.title || '" is now live and accepting participants.',
        'success',
        '/sessions/' || NEW.id::text
      );
    ELSIF NEW.status = 'grading' THEN
      v_action := 'closed';
      v_msg    := 'Closed session "' || NEW.title || '" — open answers waiting for grading';
      PERFORM public.create_notification(
        NEW.owner_id,
        'Quiz closed — needs grading',
        'Typed answers in "' || NEW.title || '" are awaiting your review.',
        'warning',
        '/sessions/' || NEW.id::text || '/grade'
      );
    ELSIF NEW.status = 'completed' AND OLD.status = 'grading' THEN
      v_action := 'finalized';
      v_msg    := 'Finalized "' || NEW.title || '" — moved to Quiz History';
      PERFORM public.create_notification(
        NEW.owner_id,
        'Session finalized',
        'All answers in "' || NEW.title || '" are graded. Results are in Quiz History.',
        'success',
        '/quiz-history'
      );
    ELSIF NEW.status = 'completed' THEN
      v_action := 'completed';
      v_msg    := 'Completed session "' || NEW.title || '"';
      PERFORM public.create_notification(
        NEW.owner_id,
        'Session completed',
        '"' || NEW.title || '" has finished. View results in Quiz History.',
        'success',
        '/quiz-history'
      );
    ELSE
      v_action := 'status_changed';
      v_msg    := 'Session "' || NEW.title || '" changed from ' || OLD.status || ' → ' || NEW.status;
    END IF;

    PERFORM public._log_session_activity(
      v_action, NEW.id, NEW.title, NEW.owner_id, v_msg,
      jsonb_build_object('from', OLD.status, 'to', NEW.status),
      CASE WHEN v_action IN ('finalized', 'closed') THEN 20 ELSE 10 END
    );
  END IF;

  -- Pause / resume detection (paused_at flips)
  IF NEW.paused_at IS NOT NULL AND OLD.paused_at IS NULL THEN
    PERFORM public._log_session_activity(
      'paused', NEW.id, NEW.title, NEW.owner_id,
      'Paused session "' || NEW.title || '"',
      '{}'::jsonb, 5
    );
  ELSIF NEW.paused_at IS NULL AND OLD.paused_at IS NOT NULL THEN
    PERFORM public._log_session_activity(
      'resumed', NEW.id, NEW.title, NEW.owner_id,
      'Resumed session "' || NEW.title || '"',
      '{}'::jsonb, 5
    );
  END IF;

  -- Scheduled-at set or changed (only when status is 'scheduled')
  IF NEW.scheduled_at IS NOT NULL
     AND OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at
     AND NEW.status = 'scheduled' THEN
    PERFORM public._log_session_activity(
      'scheduled', NEW.id, NEW.title, NEW.owner_id,
      'Scheduled "' || NEW.title || '" for ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
      jsonb_build_object('scheduled_at', NEW.scheduled_at),
      5
    );
  END IF;

  -- Reminder emails sent (edge function flips reminder_sent)
  IF COALESCE(NEW.reminder_sent, false) = true
     AND COALESCE(OLD.reminder_sent, false) = false THEN
    PERFORM public._log_session_activity(
      'reminder_sent', NEW.id, NEW.title, NEW.owner_id,
      'Sent 5-minute reminder emails for "' || NEW.title || '"',
      '{}'::jsonb, 5
    );
    PERFORM public.create_notification(
      NEW.owner_id,
      'Reminder emails sent',
      'Participants of "' || NEW.title || '" have been emailed a 5-minute reminder.',
      'info',
      '/sessions/' || NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quiz_session_audit ON public.quiz_sessions;
CREATE TRIGGER on_quiz_session_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_quiz_session_audit();

-- ─── RLS: session owners can read activity for their own sessions ────
DROP POLICY IF EXISTS "Owners read own session activity" ON public.activity_logs;
CREATE POLICY "Owners read own session activity" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    auth.uid() = plan_owner_id
    AND entity_type = 'quiz_session'
  );

-- ─── RPC for the session detail page activity panel ──────────
CREATE OR REPLACE FUNCTION public.get_session_activity(
  p_session_id UUID,
  p_limit      INT DEFAULT 100
)
RETURNS TABLE (
  id            UUID,
  actor_name    TEXT,
  actor_email   TEXT,
  action_type   TEXT,
  message       TEXT,
  details       JSONB,
  risk_score    INTEGER,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Must be the session owner OR an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_sessions WHERE id = p_session_id AND owner_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT al.id, al.actor_name, al.actor_email, al.action_type, al.message,
         al.details, al.risk_score, al.created_at
  FROM public.activity_logs al
  WHERE al.entity_type = 'quiz_session' AND al.entity_id = p_session_id
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(500, COALESCE(p_limit, 100)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_activity(UUID, INT) TO authenticated;
