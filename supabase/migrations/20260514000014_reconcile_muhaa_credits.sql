-- One-shot fix for hosts who got linked via the migration-11 backfill
-- (before accept_company_invite existed) and therefore missed their
-- initial credit transfer. We transfer the difference between what
-- the admin allocated and what actually landed in their balance.
--
-- Safety: only runs for active hosts whose admin currently has enough
-- pool to cover the missing amount.

DO $$
DECLARE
  r RECORD;
  v_missing INT;
BEGIN
  FOR r IN
    SELECT
      cm.id                  AS member_id,
      cm.user_id             AS host_user_id,
      cm.full_name           AS host_name,
      cm.credit_limit        AS allocated,
      COALESCE(uc.total_earned, 0) AS already_earned,
      cp.admin_user_id       AS admin_id,
      COALESCE(adm_uc.balance, 0) AS admin_balance
    FROM public.company_members cm
    JOIN public.company_profiles cp ON cp.id = cm.company_id
    LEFT JOIN public.user_credits uc ON uc.user_id = cm.user_id
    LEFT JOIN public.user_credits adm_uc ON adm_uc.user_id = cp.admin_user_id
    WHERE cm.status = 'active' AND cm.user_id IS NOT NULL
  LOOP
    -- Missing = whatever the member's credit_limit says minus what the
    -- host's lifetime total_earned actually shows.
    v_missing := COALESCE(r.allocated, 0) - COALESCE(r.already_earned, 0);

    IF v_missing > 0 AND v_missing <= r.admin_balance THEN
      BEGIN
        PERFORM public.deduct_credits(
          r.admin_id, v_missing, 'admin_adjustment',
          'Reconciliation: missing initial credits for ' || COALESCE(r.host_name, 'host')
        );
        PERFORM public.add_credits(
          r.host_user_id, v_missing, 'admin_adjustment',
          'Backfilled initial credits',
          r.member_id, r.admin_id
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END$$;
