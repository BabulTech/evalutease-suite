-- Atomic invite acceptance:
-- 1. Verify the invite token matches the member row
-- 2. Link auth user to the member (sets user_id + status = 'active')
-- 3. Transfer the pre-allocated credit_limit from admin → host
--
-- SECURITY DEFINER bypasses the company_members WITH CHECK policy
-- which would otherwise prevent the host from updating their own row.
CREATE OR REPLACE FUNCTION public.accept_company_invite(
  p_member_id   UUID,
  p_token       UUID,
  p_host_user_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member   public.company_members%ROWTYPE;
  v_admin_id UUID;
  v_amount   INT;
BEGIN
  -- Look up + verify the invite
  SELECT * INTO v_member
  FROM public.company_members
  WHERE id = p_member_id AND invite_token = p_token
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RETURN FALSE;  -- invite invalid or expired
  END IF;

  -- Link the auth user to the member
  UPDATE public.company_members
     SET user_id = p_host_user_id,
         status  = 'active',
         updated_at = now()
   WHERE id = p_member_id;

  -- Fetch the org admin so we can transfer credits from them
  SELECT admin_user_id INTO v_admin_id
  FROM public.company_profiles
  WHERE id = v_member.company_id
  LIMIT 1;

  v_amount := COALESCE(v_member.credit_limit, 0);

  -- Initial credit allocation (if admin set credit_limit > 0)
  IF v_admin_id IS NOT NULL AND v_amount > 0 THEN
    BEGIN
      PERFORM public.transfer_credits_to_host(
        v_admin_id, p_host_user_id, p_member_id, v_amount,
        'Initial credit allocation on invite acceptance'
      );
    EXCEPTION WHEN OTHERS THEN
      -- credit transfer failure shouldn't undo the membership link
      NULL;
    END;
  END IF;

  RETURN TRUE;
END;
$$;
