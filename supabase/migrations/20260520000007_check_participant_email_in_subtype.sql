CREATE OR REPLACE FUNCTION public.check_participant_email_in_subtype(
  p_subtype_id UUID,
  p_email      TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM participants
    WHERE subtype_id = p_subtype_id
      AND lower(email) = lower(trim(p_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_participant_email_in_subtype(UUID, TEXT) TO anon, authenticated;
