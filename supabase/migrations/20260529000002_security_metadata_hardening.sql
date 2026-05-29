-- ============================================================
-- Security hardening — response to pentest findings #1 & #2
-- (Mass Assignment via signup metadata / metadata-as-authz)
--
-- Context: the platform NEVER derives authorization from JWT
-- metadata. Admin access is resolved exclusively from the
-- server-side public.user_roles table via has_role(), which is
-- RLS-protected (only admins can write it) and the signup trigger
-- hard-codes the new user's role to 'teacher'. The injected
-- "role":"admin" value the pentest placed in user_metadata is the
-- signup *profile descriptor* (Student/Teacher/Employer), never an
-- authorization claim.
--
-- This migration removes the footgun entirely so the value can no
-- longer even be confused for one, and makes the user_roles write
-- policy explicit. Defense in depth.
-- ============================================================

-- ── 1. Strip any privilege-shaped keys from auth metadata ────
-- Runs BEFORE the row is persisted, so client-supplied
-- "role"/"is_admin"/etc. can never land in user_metadata. Any
-- legitimate signup "role" descriptor is preserved under the
-- non-privileged key "profile_role".
CREATE OR REPLACE FUNCTION public.sanitize_user_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_meta jsonb;
  v_role text;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- Preserve a client-supplied profile descriptor under a safe key.
  v_role := v_meta->>'role';
  IF v_role IS NOT NULL AND (v_meta->>'profile_role') IS NULL THEN
    v_meta := v_meta || jsonb_build_object('profile_role', v_role);
  END IF;

  -- Remove every key that could be mistaken for an authz claim.
  v_meta := v_meta
    - 'role' - 'roles' - 'is_admin' - 'admin' - 'is_super_admin'
    - 'app_role' - 'user_role' - 'claims_admin' - 'superuser';
  NEW.raw_user_meta_data := v_meta;

  -- app_metadata is server-controlled, but defend in depth anyway.
  IF NEW.raw_app_meta_data IS NOT NULL THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data
      - 'role' - 'roles' - 'is_admin' - 'admin' - 'is_super_admin'
      - 'app_role' - 'user_role' - 'claims_admin' - 'superuser';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_sanitize_meta ON auth.users;
CREATE TRIGGER on_auth_user_sanitize_meta
  BEFORE INSERT OR UPDATE OF raw_user_meta_data, raw_app_meta_data
  ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_user_metadata();

-- ── 2. Backfill: scrub any already-stored privileged keys ────
UPDATE auth.users
SET raw_user_meta_data =
      (CASE
         WHEN raw_user_meta_data->>'role' IS NOT NULL
          AND raw_user_meta_data->>'profile_role' IS NULL
         THEN raw_user_meta_data || jsonb_build_object('profile_role', raw_user_meta_data->>'role')
         ELSE raw_user_meta_data
       END)
      - 'role' - 'roles' - 'is_admin' - 'admin' - 'is_super_admin'
      - 'app_role' - 'user_role' - 'claims_admin' - 'superuser'
WHERE raw_user_meta_data ?| ARRAY[
        'role','roles','is_admin','admin','is_super_admin',
        'app_role','user_role','claims_admin','superuser'
      ];

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data
      - 'role' - 'roles' - 'is_admin' - 'admin' - 'is_super_admin'
      - 'app_role' - 'user_role' - 'claims_admin' - 'superuser'
WHERE raw_app_meta_data ?| ARRAY[
        'role','roles','is_admin','admin','is_super_admin',
        'app_role','user_role','claims_admin','superuser'
      ];

-- ── 3. Make the user_roles write policy explicit ─────────────
-- The original "FOR ALL USING (has_role admin)" already blocked
-- non-admin writes (Postgres copies USING into WITH CHECK when the
-- latter is omitted). Re-declaring with an explicit WITH CHECK is
-- self-documenting and removes any ambiguity for future auditors.
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON FUNCTION public.sanitize_user_metadata() IS
  'Strips privilege-shaped keys (role/is_admin/...) from auth.users metadata on insert/update. Authorization is resolved only from public.user_roles, never from JWT metadata.';
