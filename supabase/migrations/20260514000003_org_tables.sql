-- Ensure company_profiles table exists
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  company_type TEXT DEFAULT 'school',
  registration_no TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'Pakistan',
  phone TEXT,
  email TEXT,
  total_students INTEGER,
  established_year INTEGER,
  description TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (admin_user_id)
);

-- Ensure company_members table exists
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE NOT NULL,
  invited_email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'host',
  department TEXT,
  designation TEXT,
  subject_area TEXT,
  employee_id TEXT,
  phone TEXT,
  invite_token UUID DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending',
  credit_limit INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add credit columns if they don't exist yet (for existing installs)
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS credit_limit INTEGER DEFAULT 0;
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0;

-- RLS
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on these tables to clear any recursion-causing ones
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'company_profiles' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.company_profiles', r.policyname); END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'company_members' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.company_members', r.policyname); END LOOP;
END$$;

-- SECURITY DEFINER helper — avoids RLS recursion when policies query each other
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.company_profiles WHERE admin_user_id = auth.uid() LIMIT 1;
$$;

-- company_profiles: simple direct check, no subquery
CREATE POLICY "org_profiles_own" ON public.company_profiles
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- Site admin read-all on company_profiles
CREATE POLICY "org_profiles_site_admin" ON public.company_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- company_members: uses SECURITY DEFINER function — no direct subquery on company_profiles, no recursion
CREATE POLICY "org_members_own" ON public.company_members
  USING (company_id = public.get_my_company_id() OR user_id = auth.uid())
  WITH CHECK (company_id = public.get_my_company_id());

-- Site admin read-all on company_members
CREATE POLICY "org_members_site_admin" ON public.company_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Function: transfer credits from org admin to a member
CREATE OR REPLACE FUNCTION public.transfer_credits_to_host(
  p_admin_id UUID,
  p_host_user_id UUID,
  p_member_id UUID,
  p_amount INTEGER,
  p_note TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Deduct from admin
  PERFORM public.deduct_credits(
    p_admin_id, p_amount, 'admin_adjustment',
    COALESCE(p_note, 'Credit transfer to host')
  );

  -- Add to host
  PERFORM public.add_credits(
    p_host_user_id, p_amount, 'admin_adjustment',
    COALESCE(p_note, 'Credits allocated by org admin'),
    p_member_id, p_admin_id
  );

  -- Update member credits_used tracking
  UPDATE public.company_members
    SET credit_limit = credit_limit + p_amount, updated_at = now()
    WHERE id = p_member_id;

  RETURN true;
END;
$$;
