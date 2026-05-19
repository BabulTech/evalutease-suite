-- Re-grant execute on invite RPCs to anon role.
-- 403 errors on /invite/:token indicate these grants were lost.

GRANT EXECUTE ON FUNCTION public.get_invite_for_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_participant_invite(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
