-- Preview an invite — for the /accept-invite landing page. Callable by anon.
-- invite_token column is TEXT in production despite the schema saying UUID,
-- so we accept TEXT and compare TEXT-to-TEXT (safe with either underlying type).
CREATE OR REPLACE FUNCTION public.preview_company_invite(
  p_member_id UUID,
  p_token     TEXT
) RETURNS TABLE(
  company_name  TEXT,
  invited_email TEXT,
  is_pending    BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    cp.company_name,
    cm.invited_email,
    (cm.status <> 'active' OR cm.user_id IS NULL) AS is_pending
  FROM public.company_members cm
  JOIN public.company_profiles cp ON cp.id = cm.company_id
  WHERE cm.id = p_member_id
    AND cm.invite_token::TEXT = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.preview_company_invite(UUID, TEXT) TO anon, authenticated;
