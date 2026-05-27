-- Fix: admin deletion actions (delete user's subscriptions/credits/roles)
-- were appearing in the affected user's activity feed because trg_generic_audit
-- sets plan_owner_id = the deleted row's user_id.
-- Normal users should only see actions THEY performed, plus a small set of
-- system events meaningful to them (plan activated, quiz assigned, etc.).

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
    -- Only show actions the user performed themselves,
    -- OR meaningful system events where no specific actor exists.
    -- This hides admin-initiated deletions (delete user's sub/credits/roles)
    -- from the affected user's feed.
    AND (
      al.actor_user_id = auth.uid()
      OR al.actor_user_id IS NULL
      OR al.action_type IN (
        'payment_approved', 'payment_rejected',
        'quiz_scheduled', 'quiz_started', 'quiz_completed',
        'plan_activated', 'credits_added', 'signed_up'
      )
    )
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(100, COALESCE(p_limit, 20)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_recent_activity(INT) TO authenticated;
