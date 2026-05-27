-- Robust admin_delete_user: cleans ALL related public tables before
-- removing from auth.users, so FK constraints never block deletion.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Public schema cleanup (order matters for FK chains)
  DELETE FROM public.notifications        WHERE user_id      = p_user_id;
  -- activity_logs.actor_user_id is ON DELETE SET NULL — no explicit delete needed
  DELETE FROM public.trial_ai_usage       WHERE user_id      = p_user_id;
  DELETE FROM public.manual_payments      WHERE user_id    = p_user_id;
  DELETE FROM public.user_subscriptions   WHERE user_id    = p_user_id;
  DELETE FROM public.user_credits         WHERE user_id    = p_user_id;
  DELETE FROM public.user_roles           WHERE user_id    = p_user_id;
  -- quiz_session_participants cascades from quiz_sessions (no user_id column)
  DELETE FROM public.company_members      WHERE user_id    = p_user_id;

  -- Nullify reviewed_by references in manual_payments (other users' payments)
  UPDATE public.manual_payments SET reviewed_by = NULL WHERE reviewed_by = p_user_id;

  -- Remove company ownership (if they owned an org)
  DELETE FROM public.company_profiles     WHERE admin_user_id = p_user_id;

  -- Remove quiz content owned by user
  DELETE FROM public.quiz_sessions        WHERE owner_id   = p_user_id;
  DELETE FROM public.questions            WHERE owner_id   = p_user_id;
  DELETE FROM public.participants         WHERE owner_id   = p_user_id;

  -- Remove profile last (before auth row)
  DELETE FROM public.profiles             WHERE id         = p_user_id;

  -- Finally remove from Supabase Auth
  DELETE FROM auth.users                  WHERE id         = p_user_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
