-- ============================================================
-- Enterprise work-email enforcement (server-side, unbypassable)
--
-- Client-side, the signup flow blocks non-school enterprise
-- accounts from registering with a personal/free email provider
-- (Gmail, Yahoo, Outlook, …). This migration mirrors that rule in
-- the database so the API cannot be called directly to bypass it.
--
-- Rule: when raw_user_meta_data->>'enterprise_type' is present and
-- is anything other than 'school', the email domain must NOT be a
-- known free/personal provider. Personal accounts (no enterprise_type
-- or an empty value) and schools are unaffected.
--
-- Implemented as a BEFORE INSERT trigger on auth.users that RAISES,
-- aborting the insert — supabase.auth.signUp then surfaces the error.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_enterprise_work_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_type   text;
  v_domain text;
  -- Keep in sync with FREE_EMAIL_DOMAINS in src/routes/signup/constants.ts
  v_free_domains text[] := ARRAY[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
    'rocketmail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com',
    'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me',
    'protonmail.com', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'zoho.com'
  ];
BEGIN
  v_type := NULLIF(trim(lower(COALESCE(NEW.raw_user_meta_data->>'enterprise_type', ''))), '');

  -- Only enterprise accounts that are NOT schools are restricted.
  IF v_type IS NULL OR v_type = 'school' THEN
    RETURN NEW;
  END IF;

  v_domain := lower(split_part(COALESCE(NEW.email, ''), '@', 2));

  IF v_domain = ANY (v_free_domains) THEN
    RAISE EXCEPTION 'Company accounts must register with a work email; personal providers like Gmail or Yahoo are not allowed.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_enterprise_work_email ON auth.users;
CREATE TRIGGER on_auth_user_enterprise_work_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_enterprise_work_email();

COMMENT ON FUNCTION public.enforce_enterprise_work_email() IS
  'Blocks non-school enterprise signups (raw_user_meta_data.enterprise_type != school) that use a free/personal email domain. Server-side mirror of the client work-email rule.';
