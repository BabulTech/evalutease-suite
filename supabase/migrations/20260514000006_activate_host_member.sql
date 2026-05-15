-- Called when a host accepts their invite.
-- Transfers credit_limit credits from the org admin to the new host.
-- SECURITY DEFINER so it can read company_profiles regardless of RLS.
CREATE OR REPLACE FUNCTION public.activate_host_member(
  p_member_id   UUID,
  p_host_user_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member   public.company_members%ROWTYPE;
  v_admin_id UUID;
  v_amount   INT;
BEGIN
  SELECT * INTO v_member FROM public.company_members WHERE id = p_member_id LIMIT 1;
  IF v_member.id IS NULL THEN RETURN FALSE; END IF;

  SELECT admin_user_id INTO v_admin_id
  FROM public.company_profiles WHERE id = v_member.company_id LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN FALSE; END IF;

  v_amount := COALESCE(v_member.credit_limit, 0);

  -- Only transfer if admin allocated credits upfront
  IF v_amount > 0 THEN
    PERFORM public.transfer_credits_to_host(
      v_admin_id, p_host_user_id, p_member_id, v_amount,
      'Initial credit allocation on invite acceptance'
    );
  END IF;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;
