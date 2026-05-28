-- Log quiz reviews (participant feedback) into the host's activity feed.
-- quiz_feedback has no owner column; the owner is the session's owner_id.

CREATE OR REPLACE FUNCTION public.trg_quiz_feedback_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner   UUID;
  v_title   TEXT;
  v_stars   TEXT;
BEGIN
  SELECT owner_id, title INTO v_owner, v_title
  FROM public.quiz_sessions WHERE id = NEW.session_id;

  IF v_owner IS NULL THEN
    RETURN NEW; -- orphan session, nothing to attribute
  END IF;

  -- Star string e.g. "★★★★☆"
  v_stars := repeat('★', NEW.rating) || repeat('☆', GREATEST(0, 5 - NEW.rating));

  PERFORM public._log_app_activity(
    'review_received',
    'feedback',
    'quiz_feedback',
    NEW.id,
    COALESCE(v_title, 'a quiz'),
    v_owner,
    'New review ' || v_stars || ' (' || NEW.rating || '/5) from '
      || COALESCE(NULLIF(NEW.participant_name, ''), 'a participant')
      || ' on "' || COALESCE(v_title, 'your quiz') || '"'
      || CASE WHEN NULLIF(trim(COALESCE(NEW.comment, '')), '') IS NOT NULL
              THEN ': "' || left(NEW.comment, 120) || '"'
              ELSE '' END,
    jsonb_build_object(
      'rating',     NEW.rating,
      'session_id', NEW.session_id,
      'comment',    NEW.comment
    ),
    5
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block a participant's review submission
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_feedback_audit ON public.quiz_feedback;
CREATE TRIGGER trg_quiz_feedback_audit
  AFTER INSERT ON public.quiz_feedback
  FOR EACH ROW EXECUTE FUNCTION public.trg_quiz_feedback_audit();

-- Make sure review events surface in the host's feed.
CREATE OR REPLACE FUNCTION public.get_my_recent_activity(p_limit INT DEFAULT 20)
RETURNS TABLE (
  id            UUID,
  actor_name    TEXT,
  action_type   TEXT,
  module        TEXT,
  entity_type   TEXT,
  entity_id     UUID,
  entity_label  TEXT,
  message       TEXT,
  details       JSONB,
  risk_score    INTEGER,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT al.id,
         COALESCE(p.full_name, split_part(COALESCE(p.email, ''), '@', 1), 'Unknown user') AS actor_name,
         al.action_type, al.module, al.entity_type, al.entity_id,
         al.entity_label, al.message, al.details, al.risk_score, al.created_at
  FROM public.activity_logs al
  LEFT JOIN public.profiles p ON p.id = al.actor_user_id
  WHERE al.plan_owner_id = auth.uid()
    AND (
      al.actor_user_id = auth.uid()
      OR al.actor_user_id IS NULL
      OR al.action_type IN (
        'payment_approved', 'payment_rejected',
        'quiz_scheduled', 'quiz_started', 'quiz_completed',
        'plan_activated', 'credits_added', 'signed_up',
        'review_received'
      )
    )
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(100, COALESCE(p_limit, 20)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_recent_activity(INT) TO authenticated;
