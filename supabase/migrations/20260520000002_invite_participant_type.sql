-- Add participant_type to participant_invites so the host can lock
-- the type (student / teacher / employee / fun) when generating an invite.
-- The invite page then renders fields for that type and does NOT let
-- the participant change their type.

ALTER TABLE public.participant_invites
  ADD COLUMN IF NOT EXISTS participant_type TEXT;

-- Expose participant_type + host registration_fields_by_type from get_invite_for_token
CREATE OR REPLACE FUNCTION public.get_invite_for_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite   participant_invites%ROWTYPE;
  v_type     participant_types%ROWTYPE;
  v_sub      participant_subtypes%ROWTYPE;
  v_hs_rf    JSONB;
  v_hs_rfbt  JSONB;
BEGIN
  SELECT * INTO v_invite
  FROM participant_invites
  WHERE token = p_token;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_sub  FROM participant_subtypes WHERE id = v_invite.subtype_id;
  SELECT * INTO v_type FROM participant_types    WHERE id = v_sub.type_id;

  -- Fetch host's registration field config
  SELECT registration_fields, registration_fields_by_type
  INTO v_hs_rf, v_hs_rfbt
  FROM host_settings
  WHERE owner_id = v_invite.owner_id;

  RETURN jsonb_build_object(
    'invite',                    jsonb_build_object('id', v_invite.id, 'status', v_invite.status, 'email', v_invite.email),
    'type',                      jsonb_build_object('id', v_type.id, 'name', v_type.name, 'icon', v_type.icon),
    'subtype',                   jsonb_build_object('id', v_sub.id, 'name', v_sub.name),
    'participant_type',          v_invite.participant_type,
    'host_registration_fields',  COALESCE(v_hs_rf, '{}'::jsonb),
    'host_fields_by_type',       COALESCE(v_hs_rfbt, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_for_token(TEXT) TO anon, authenticated;
