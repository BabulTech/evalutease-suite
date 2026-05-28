-- Hide low-value "noise" events from the user's Recent Activity feed.
-- Profile self-updates (from session self-heal / metadata sync) flooded the
-- feed with "Updated profiles" rows. Only surface meaningful actions.

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
      -- Any DB change the user themselves made (questions, participants,
      -- sessions, profile edits, settings, etc.) is shown.
      al.actor_user_id = auth.uid()
      -- Pure system events with no actor (e.g. trial expiry).
      OR al.actor_user_id IS NULL
      -- Meaningful events triggered by others (admin approves your payment).
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

-- Optional one-time cleanup: purge the historical profile-update noise so the
-- feed isn't backfilled with old "Updated profiles" rows.
DELETE FROM public.activity_logs
WHERE entity_type = 'profiles' AND action_type = 'updated';
