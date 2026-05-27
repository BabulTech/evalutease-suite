-- ── 1. Show all auth users missing a profile row ────────────
SELECT
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at,
  p.id AS profile_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- ── 2. Check the trigger exists on auth.users ────────────────
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- ── 3. Force-create missing rows for ALL auth users ──────────
-- Profiles
INSERT INTO public.profiles (id, email, full_name, selected_plan, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(TRIM(
      COALESCE(u.raw_user_meta_data->>'first_name','') || ' ' ||
      COALESCE(u.raw_user_meta_data->>'last_name','')
    ),' '),
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    SPLIT_PART(u.email,'@',1)
  ),
  'individual_starter',
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- user_credits
INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
SELECT u.id, 0, 0, 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_credits c WHERE c.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- user_subscriptions
INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
SELECT u.id, p.id, 'active', NULL
FROM auth.users u
CROSS JOIN (SELECT id FROM public.plans WHERE slug = 'individual_starter'::public.plan_slug LIMIT 1) p
WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions s WHERE s.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- ── 4. Verify the fix ────────────────────────────────────────
SELECT
  u.email,
  CASE WHEN p.id IS NOT NULL THEN '✓ profile' ELSE '✗ missing' END AS profile,
  CASE WHEN r.user_id IS NOT NULL THEN '✓ role' ELSE '✗ missing' END AS role,
  CASE WHEN c.user_id IS NOT NULL THEN '✓ credits' ELSE '✗ missing' END AS credits,
  CASE WHEN s.user_id IS NOT NULL THEN '✓ sub' ELSE '✗ missing' END AS subscription
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'teacher'
LEFT JOIN public.user_credits c ON c.user_id = u.id
LEFT JOIN public.user_subscriptions s ON s.user_id = u.id
ORDER BY u.created_at DESC;
