-- Strip em-dashes (—) and en-dashes (–) from activity log text so the feed
-- never shows them. Two parts:
--   1. Sanitize at the single write choke-point (_log_app_activity) so all
--      future trigger-generated messages are clean, regardless of source.
--   2. One-time cleanup of existing rows + the one plan description that has it.

-- ── 1. Sanitize on write ───────────────────────────────────
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
  v_msg   TEXT := regexp_replace(COALESCE(p_message, ''),      '\s*[—–]\s*', ' - ', 'g');
  v_label TEXT := regexp_replace(COALESCE(p_entity_label, ''), '\s*[—–]\s*', ' - ', 'g');
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
    NULLIF(left(trim(v_label), 240), ''),
    COALESCE(NULLIF(trim(v_msg), ''), 'Activity recorded'),
    COALESCE(p_details, '{}'::jsonb),
    GREATEST(0, LEAST(100, COALESCE(p_risk_score, 0)))
  );
END;
$$;

-- ── 2. Clean existing data ─────────────────────────────────
UPDATE public.activity_logs
SET message      = regexp_replace(message,      '\s*[—–]\s*', ' - ', 'g'),
    entity_label = regexp_replace(COALESCE(entity_label, ''), '\s*[—–]\s*', ' - ', 'g')
WHERE message LIKE '%—%' OR message LIKE '%–%'
   OR entity_label LIKE '%—%' OR entity_label LIKE '%–%';

UPDATE public.plans
SET description = regexp_replace(description, '\s*[—–]\s*', ' - ', 'g')
WHERE description LIKE '%—%' OR description LIKE '%–%';
