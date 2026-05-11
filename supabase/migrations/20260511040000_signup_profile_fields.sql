-- Add new signup profile fields to the profiles table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role             TEXT CHECK (role IN ('Student', 'Teacher', 'Employer', 'Other')),
  ADD COLUMN IF NOT EXISTS use_cases        TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS referral         TEXT     CHECK (referral IN ('Ads', 'Friend Recommendation', 'Employee Referral', 'Web Search')),
  ADD COLUMN IF NOT EXISTS selected_plan    TEXT,

  -- Student fields
  ADD COLUMN IF NOT EXISTS school           TEXT,
  ADD COLUMN IF NOT EXISTS grade_year       TEXT,
  ADD COLUMN IF NOT EXISTS field_of_study   TEXT,

  -- Teacher fields
  ADD COLUMN IF NOT EXISTS institution      TEXT,
  ADD COLUMN IF NOT EXISTS subject_taught   TEXT,
  ADD COLUMN IF NOT EXISTS years_exp        TEXT,

  -- Employer fields
  ADD COLUMN IF NOT EXISTS company_name     TEXT,
  ADD COLUMN IF NOT EXISTS industry         TEXT,
  ADD COLUMN IF NOT EXISTS team_size        TEXT,

  -- Other
  ADD COLUMN IF NOT EXISTS other_details    TEXT;

-- Update the on_auth_user_created trigger to populate new fields from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, first_name, last_name, avatar_url,
    mobile, organization,
    role, use_cases, referral, selected_plan,
    school, grade_year, field_of_study,
    institution, subject_taught, years_exp,
    company_name, industry, team_size,
    other_details
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'mobile',
    NEW.raw_user_meta_data->>'organization',
    NEW.raw_user_meta_data->>'role',
    CASE
      WHEN NEW.raw_user_meta_data->'use_cases' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'use_cases'))
      ELSE '{}'::TEXT[]
    END,
    NEW.raw_user_meta_data->>'referral',
    NEW.raw_user_meta_data->>'selected_plan',
    NEW.raw_user_meta_data->>'school',
    NEW.raw_user_meta_data->>'grade_year',
    NEW.raw_user_meta_data->>'field_of_study',
    NEW.raw_user_meta_data->>'institution',
    NEW.raw_user_meta_data->>'subject_taught',
    NEW.raw_user_meta_data->>'years_exp',
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'industry',
    NEW.raw_user_meta_data->>'team_size',
    NEW.raw_user_meta_data->>'other_details'
  )
  ON CONFLICT (id) DO UPDATE SET
    email          = EXCLUDED.email,
    full_name      = COALESCE(EXCLUDED.full_name, profiles.full_name),
    first_name     = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name      = COALESCE(EXCLUDED.last_name, profiles.last_name),
    avatar_url     = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    mobile         = COALESCE(EXCLUDED.mobile, profiles.mobile),
    organization   = COALESCE(EXCLUDED.organization, profiles.organization),
    role           = COALESCE(EXCLUDED.role, profiles.role),
    use_cases      = CASE WHEN array_length(EXCLUDED.use_cases, 1) > 0 THEN EXCLUDED.use_cases ELSE profiles.use_cases END,
    referral       = COALESCE(EXCLUDED.referral, profiles.referral),
    selected_plan  = COALESCE(EXCLUDED.selected_plan, profiles.selected_plan),
    school         = COALESCE(EXCLUDED.school, profiles.school),
    grade_year     = COALESCE(EXCLUDED.grade_year, profiles.grade_year),
    field_of_study = COALESCE(EXCLUDED.field_of_study, profiles.field_of_study),
    institution    = COALESCE(EXCLUDED.institution, profiles.institution),
    subject_taught = COALESCE(EXCLUDED.subject_taught, profiles.subject_taught),
    years_exp      = COALESCE(EXCLUDED.years_exp, profiles.years_exp),
    company_name   = COALESCE(EXCLUDED.company_name, profiles.company_name),
    industry       = COALESCE(EXCLUDED.industry, profiles.industry),
    team_size      = COALESCE(EXCLUDED.team_size, profiles.team_size),
    other_details  = COALESCE(EXCLUDED.other_details, profiles.other_details),
    updated_at     = now();
  RETURN NEW;
END;
$$;
