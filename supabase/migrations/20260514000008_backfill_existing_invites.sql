-- One-time backfill: link any pending company_members rows to their auth user
-- by matching invited_email → auth.users.email. Activates rows that have an
-- auth account created but were never linked due to the silent RLS failure.
DO $$
DECLARE
  r RECORD;
  v_admin_id UUID;
  v_amount   INT;
BEGIN
  FOR r IN
    SELECT cm.id AS member_id, cm.invited_email, cm.company_id, cm.credit_limit, u.id AS auth_user_id
    FROM public.company_members cm
    JOIN auth.users u ON lower(u.email) = lower(cm.invited_email)
    WHERE cm.user_id IS NULL OR cm.status <> 'active'
  LOOP
    UPDATE public.company_members
       SET user_id = r.auth_user_id, status = 'active', updated_at = now()
     WHERE id = r.member_id;

    SELECT admin_user_id INTO v_admin_id
    FROM public.company_profiles WHERE id = r.company_id LIMIT 1;

    v_amount := COALESCE(r.credit_limit, 0);

    IF v_admin_id IS NOT NULL AND v_amount > 0 THEN
      BEGIN
        PERFORM public.transfer_credits_to_host(
          v_admin_id, r.auth_user_id, r.member_id, v_amount,
          'Backfilled initial credit allocation'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END$$;
