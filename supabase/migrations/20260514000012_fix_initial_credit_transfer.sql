-- ============================================================
-- FIX: accept_company_invite was calling transfer_credits_to_host
-- which mutates credit_limit again, double-counting the lifetime
-- allocation. Initial transfer should NOT touch credit_limit
-- (it was already set by the admin when the host was invited).
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_company_invite(
  p_member_id    UUID,
  p_token        UUID,
  p_host_user_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member   public.company_members%ROWTYPE;
  v_admin_id UUID;
  v_amount   INT;
BEGIN
  SELECT * INTO v_member
  FROM public.company_members
  WHERE id = p_member_id AND invite_token = p_token
  LIMIT 1;
  IF v_member.id IS NULL THEN RETURN FALSE; END IF;

  -- Link the auth user
  UPDATE public.company_members
     SET user_id = p_host_user_id,
         status  = 'active',
         updated_at = now()
   WHERE id = p_member_id;

  SELECT admin_user_id INTO v_admin_id
    FROM public.company_profiles
   WHERE id = v_member.company_id
   LIMIT 1;
  v_amount := COALESCE(v_member.credit_limit, 0);

  -- Initial credit allocation: deduct from admin, add to host.
  -- Done directly (NOT via transfer_credits_to_host) because
  -- credit_limit is already correct from the admin's invite form.
  IF v_admin_id IS NOT NULL AND v_amount > 0 THEN
    BEGIN
      PERFORM public.deduct_credits(
        v_admin_id, v_amount, 'admin_adjustment',
        'Initial credit allocation to ' || COALESCE(v_member.full_name, 'host')
      );
      PERFORM public.add_credits(
        p_host_user_id, v_amount, 'admin_adjustment',
        'Initial credits from organization',
        p_member_id, v_admin_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- credit transfer failure shouldn't undo the membership link
      NULL;
    END;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_company_invite(UUID, UUID, UUID) TO authenticated, anon;
