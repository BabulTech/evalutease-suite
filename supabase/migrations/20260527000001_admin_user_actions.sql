-- Admin: suspend a user (sets subscription status to suspended)
CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET status = 'suspended', updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Admin: unsuspend a user (sets subscription status back to active)
CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET status = 'active', updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Drop FK constraints on activity_logs so audit records don't block user deletion
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_actor_user_id_fkey;
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_plan_owner_id_fkey;

-- Admin: delete a user (cleans up related data then removes auth user)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.trial_ai_usage WHERE user_id = p_user_id;
  DELETE FROM public.manual_payments WHERE user_id = p_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Grant execute to authenticated (admin check is done at app level via RLS/role)
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
