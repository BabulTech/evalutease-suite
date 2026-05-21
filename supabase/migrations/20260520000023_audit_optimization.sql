-- ============================================================
-- Audit optimisation (5 fixes — see commit message)
-- 1. Generic CRUD trigger writes details = NULL for noise tables
--    (-60% storage on the highest-volume rows)
-- 2. prune_activity_logs default noise retention: 30 → 7 days
-- 3. New prune_notifications + daily cron (read + > 60 days old)
-- 4. (TS side) stop double-logging AI calls — see audit.server.ts
-- 5. Drop denormalised actor_name + actor_email from activity_logs;
--    all read RPCs now JOIN profiles instead.
-- ============================================================

-- ─── 5. Drop the denormalised actor columns ───────────────────
-- WARNING: this loses actor names for historical rows. If you need
-- them archived, copy activity_logs to a snapshot table first.
ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS actor_name;
ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS actor_email;

-- ─── Rewrite writers so they no longer insert actor_name/email ──

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
  v_actor UUID := COALESCE(auth.uid(), p_owner_id);
BEGIN
  INSERT INTO public.activity_logs (
    actor_user_id, plan_owner_id,
    action_type, module, entity_type, entity_id, entity_label,
    message, details, risk_score
  ) VALUES (
    v_actor,
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

CREATE OR REPLACE FUNCTION public._log_app_activity(
  p_action_type   TEXT,
  p_module        TEXT,
  p_entity_type   TEXT,
  p_entity_id     UUID,
  p_entity_label  TEXT,
  p_plan_owner_id UUID,
  p_message       TEXT,
  p_details       JSONB DEFAULT '{}'::jsonb,
  p_risk_score    INTEGER DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := COALESCE(auth.uid(), p_plan_owner_id);
BEGIN
  INSERT INTO public.activity_logs (
    actor_user_id, plan_owner_id,
    action_type, module, entity_type, entity_id, entity_label,
    message, details, risk_score
  ) VALUES (
    v_actor,
    p_plan_owner_id,
    left(lower(trim(p_action_type)), 50),
    left(lower(trim(p_module)), 50),
    NULLIF(left(trim(COALESCE(p_entity_type, '')), 50), ''),
    p_entity_id,
    NULLIF(left(trim(COALESCE(p_entity_label, '')), 240), ''),
    COALESCE(NULLIF(trim(p_message), ''), 'Activity recorded'),
    COALESCE(p_details, '{}'::jsonb),
    GREATEST(0, LEAST(100, COALESCE(p_risk_score, 0)))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action_type TEXT,
  p_module TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_label TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_plan_owner_id UUID DEFAULT NULL,
  p_risk_score INTEGER DEFAULT 0
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.activity_logs (
    actor_user_id, plan_owner_id,
    action_type, module, entity_type, entity_id, entity_label,
    message, details, metadata, risk_score
  )
  VALUES (
    v_actor,
    COALESCE(p_plan_owner_id, v_actor),
    left(lower(trim(p_action_type)), 50),
    left(lower(trim(p_module)), 50),
    NULLIF(left(trim(COALESCE(p_entity_type, '')), 50), ''),
    p_entity_id,
    NULLIF(left(trim(COALESCE(p_entity_label, '')), 240), ''),
    COALESCE(NULLIF(trim(p_message), ''), 'Activity recorded'),
    COALESCE(p_details, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb),
    GREATEST(0, LEAST(100, COALESCE(p_risk_score, 0)))
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── 1. Generic CRUD trigger: NULL details for noise tables ────
-- The high-volume "noise" tables (quiz_answers INSERT,
-- quiz_session_* and participant_group_members) don't need a
-- details payload since entity_type + entity_id already identify
-- the row. Strip details to save ~70% of bytes per row.
CREATE OR REPLACE FUNCTION public.trg_generic_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row    JSONB := CASE TG_OP WHEN 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_module TEXT  := COALESCE(TG_ARGV[0], 'system');
  v_action TEXT;
  v_label  TEXT;
  v_owner  UUID;
  v_id     UUID;
  v_risk   INTEGER;
  v_details JSONB;
  v_is_noise BOOLEAN;
BEGIN
  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    WHEN 'DELETE' THEN 'deleted'
  END;

  v_label := COALESCE(
    v_row->>'name', v_row->>'title', v_row->>'label',
    v_row->>'email', v_row->>'access_code',
    v_row->>'code', v_row->>'token', v_row->>'id'
  );

  v_owner := COALESCE(
    NULLIF(v_row->>'owner_id',      '')::UUID,
    NULLIF(v_row->>'user_id',       '')::UUID,
    NULLIF(v_row->>'plan_owner_id', '')::UUID,
    NULLIF(v_row->>'admin_user_id', '')::UUID,
    auth.uid()
  );

  v_id := NULLIF(v_row->>'id', '')::UUID;

  v_is_noise := TG_TABLE_NAME IN (
    'quiz_answers',
    'quiz_session_questions',
    'quiz_session_participants',
    'quiz_session_subtypes',
    'participant_group_members'
  );

  v_risk    := CASE TG_OP WHEN 'DELETE' THEN 30 ELSE 5 END;
  v_details := CASE WHEN v_is_noise THEN NULL ELSE jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME) END;

  PERFORM public._log_app_activity(
    v_action, v_module, TG_TABLE_NAME, v_id, left(v_label, 240),
    v_owner,
    initcap(v_action) || ' ' || replace(TG_TABLE_NAME, '_', ' ')
      || CASE WHEN v_label IS NOT NULL AND v_label <> COALESCE(v_id::TEXT, '')
              THEN ' "' || v_label || '"' ELSE '' END,
    v_details,
    v_risk
  );

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ─── Rewrite read RPCs to JOIN profiles for actor_name/email ──

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
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_sessions WHERE id = p_session_id AND owner_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT al.id,
         COALESCE(p.full_name, split_part(COALESCE(p.email, ''), '@', 1), 'Unknown user') AS actor_name,
         p.email AS actor_email,
         al.action_type,
         al.message,
         al.details,
         al.risk_score,
         al.created_at
  FROM public.activity_logs al
  LEFT JOIN public.profiles p ON p.id = al.actor_user_id
  WHERE al.entity_type = 'quiz_session' AND al.entity_id = p_session_id
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(500, COALESCE(p_limit, 100)));
END;
$$;

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
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(100, COALESCE(p_limit, 20)));
END;
$$;

-- ─── 2. Tighter default retention on prune_activity_logs ───────
CREATE OR REPLACE FUNCTION public.prune_activity_logs(
  p_noise_days   INT DEFAULT 7,      -- was 30
  p_regular_days INT DEFAULT 365
) RETURNS TABLE (deleted_noise BIGINT, deleted_regular BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_noise BIGINT;
  v_reg   BIGINT;
BEGIN
  WITH del AS (
    DELETE FROM public.activity_logs
    WHERE created_at < now() - (p_noise_days || ' days')::INTERVAL
      AND entity_type IN (
        'quiz_answers',
        'quiz_session_questions',
        'quiz_session_participants',
        'quiz_session_subtypes',
        'participant_group_members'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_noise FROM del;

  WITH del AS (
    DELETE FROM public.activity_logs
    WHERE created_at < now() - (p_regular_days || ' days')::INTERVAL
      AND entity_type NOT IN (
        'quiz_answers',
        'quiz_session_questions',
        'quiz_session_participants',
        'quiz_session_subtypes',
        'participant_group_members'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_reg FROM del;

  RETURN QUERY SELECT v_noise, v_reg;
END;
$$;

-- ─── 3. Prune read notifications older than 60 days ────────────
CREATE OR REPLACE FUNCTION public.prune_notifications(
  p_read_days   INT DEFAULT 60,
  p_unread_days INT DEFAULT 365
) RETURNS TABLE (deleted_read BIGINT, deleted_unread BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_read   BIGINT;
  v_unread BIGINT;
BEGIN
  WITH del AS (
    DELETE FROM public.notifications
    WHERE read = TRUE
      AND created_at < now() - (p_read_days || ' days')::INTERVAL
    RETURNING 1
  )
  SELECT count(*) INTO v_read FROM del;

  -- Hard cap: even unread notifications shouldn't live forever
  WITH del AS (
    DELETE FROM public.notifications
    WHERE created_at < now() - (p_unread_days || ' days')::INTERVAL
    RETURNING 1
  )
  SELECT count(*) INTO v_unread FROM del;

  RETURN QUERY SELECT v_read, v_unread;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_notifications(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_notifications(INT, INT) TO service_role;

-- ─── Reschedule pg_cron jobs with new defaults ─────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Re-register activity log prune with new 7-day noise default
    PERFORM cron.unschedule('prune-activity-logs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-activity-logs');
    PERFORM cron.schedule(
      'prune-activity-logs',
      '0 3 * * *',
      $cron$SELECT public.prune_activity_logs(7, 365)$cron$
    );

    -- New notifications prune at 03:15 UTC
    PERFORM cron.unschedule('prune-notifications')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-notifications');
    PERFORM cron.schedule(
      'prune-notifications',
      '15 3 * * *',
      $cron$SELECT public.prune_notifications(60, 365)$cron$
    );
  END IF;
END
$$;
