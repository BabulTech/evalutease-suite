-- Make participant invite links reusable (unlimited registrations from one link).
-- Previously the link was marked 'accepted' after first use, blocking everyone else.
-- Now: status stays 'pending', use_count increments, any number of people can join.

ALTER TABLE public.participant_invites
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.redeem_participant_invite(
  p_token    TEXT,
  p_name     TEXT,
  p_email    TEXT    DEFAULT NULL,
  p_mobile   TEXT    DEFAULT NULL,
  p_metadata JSONB   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite       participant_invites%ROWTYPE;
  v_participant_id UUID;
  v_ip           TEXT;
BEGIN
  v_ip := coalesce(
    split_part(trim(current_setting('request.headers', true)::jsonb->>'x-forwarded-for'), ',', 1),
    current_setting('request.headers', true)::jsonb->>'x-real-ip',
    'unknown'
  );
  v_ip := trim(v_ip);

  IF NOT public._rl_check('invite_redeem', v_ip, 10, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT * INTO v_invite FROM participant_invites WHERE token = p_token;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- No longer block on 'accepted' — links are reusable
  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('error', 'revoked');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;

  INSERT INTO participants (owner_id, name, email, mobile, metadata, subtype_id)
  VALUES (
    v_invite.owner_id,
    trim(p_name),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    NULLIF(trim(COALESCE(p_mobile, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    v_invite.subtype_id
  )
  RETURNING id INTO v_participant_id;

  -- Increment use count but keep status as 'pending' so link stays open
  UPDATE participant_invites
  SET use_count    = use_count + 1,
      accepted_at  = now(),
      accepted_participant_id = v_participant_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_participant_invite(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
