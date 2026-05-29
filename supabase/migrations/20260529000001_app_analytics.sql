-- ============================================================
-- Admin analytics RPC: one-shot KPIs for the Analytics dashboard
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_app_analytics()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now            TIMESTAMPTZ := now();
  v_5min_ago       TIMESTAMPTZ := v_now - INTERVAL '5 minutes';
  v_24h_ago        TIMESTAMPTZ := v_now - INTERVAL '24 hours';
  v_7d_ago         TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_30d_ago        TIMESTAMPTZ := v_now - INTERVAL '30 days';

  v_total_users    BIGINT;
  v_new_24h        BIGINT;
  v_new_7d         BIGINT;
  v_new_30d        BIGINT;

  v_online_now     BIGINT;
  v_dau            BIGINT;
  v_wau            BIGINT;
  v_mau            BIGINT;

  v_android        BIGINT;
  v_ios            BIGINT;
  v_web_push       BIGINT;

  v_total_quizzes  BIGINT;
  v_quizzes_24h    BIGINT;
  v_quizzes_7d     BIGINT;
  v_total_questions BIGINT;
  v_total_participants BIGINT;
  v_ai_calls_7d    BIGINT;
  v_ai_cost_7d     NUMERIC;

  v_revenue_total  BIGINT;
  v_revenue_7d     BIGINT;
  v_pending_pay    BIGINT;

  v_signups_daily  JSONB;
  v_activity_daily JSONB;
  v_installs_daily JSONB;
  v_revenue_daily  JSONB;
  v_plan_dist      JSONB;
  v_top_users      JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized: admin role required';
  END IF;

  -- ── Users ────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  SELECT COUNT(*) INTO v_new_24h     FROM auth.users WHERE created_at > v_24h_ago;
  SELECT COUNT(*) INTO v_new_7d      FROM auth.users WHERE created_at > v_7d_ago;
  SELECT COUNT(*) INTO v_new_30d     FROM auth.users WHERE created_at > v_30d_ago;

  -- ── Activity (DAU / WAU / MAU / online now) ──────────────
  SELECT COUNT(DISTINCT actor_user_id) INTO v_online_now
  FROM public.activity_logs
  WHERE created_at > v_5min_ago AND actor_user_id IS NOT NULL;

  SELECT COUNT(DISTINCT actor_user_id) INTO v_dau
  FROM public.activity_logs
  WHERE created_at > v_24h_ago AND actor_user_id IS NOT NULL;

  SELECT COUNT(DISTINCT actor_user_id) INTO v_wau
  FROM public.activity_logs
  WHERE created_at > v_7d_ago AND actor_user_id IS NOT NULL;

  SELECT COUNT(DISTINCT actor_user_id) INTO v_mau
  FROM public.activity_logs
  WHERE created_at > v_30d_ago AND actor_user_id IS NOT NULL;

  -- ── Installs / push subscriptions by platform ────────────
  -- push_subscriptions table only exists if migration 20260528000010 ran
  BEGIN
    SELECT COUNT(DISTINCT user_id) INTO v_android FROM public.push_subscriptions WHERE platform = 'android';
    SELECT COUNT(DISTINCT user_id) INTO v_ios     FROM public.push_subscriptions WHERE platform = 'ios';
    SELECT COUNT(DISTINCT user_id) INTO v_web_push FROM public.push_subscriptions WHERE platform = 'web';
  EXCEPTION WHEN OTHERS THEN
    v_android := 0; v_ios := 0; v_web_push := 0;
  END;

  -- ── Quizzes / content ────────────────────────────────────
  SELECT COUNT(*) INTO v_total_quizzes  FROM public.quiz_sessions;
  SELECT COUNT(*) INTO v_quizzes_24h    FROM public.quiz_sessions WHERE created_at > v_24h_ago;
  SELECT COUNT(*) INTO v_quizzes_7d     FROM public.quiz_sessions WHERE created_at > v_7d_ago;
  SELECT COUNT(*) INTO v_total_questions FROM public.questions;
  SELECT COUNT(*) INTO v_total_participants FROM public.participants;

  -- ── AI usage ─────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*), COALESCE(SUM(estimated_cost::numeric), 0)
      INTO v_ai_calls_7d, v_ai_cost_7d
    FROM public.ai_usage_logs
    WHERE created_at > v_7d_ago;
  EXCEPTION WHEN OTHERS THEN
    v_ai_calls_7d := 0; v_ai_cost_7d := 0;
  END;

  -- ── Revenue (approved manual payments) ───────────────────
  SELECT COALESCE(SUM(amount_pkr), 0) INTO v_revenue_total
  FROM public.manual_payments WHERE status = 'approved';

  SELECT COALESCE(SUM(amount_pkr), 0) INTO v_revenue_7d
  FROM public.manual_payments
  WHERE status = 'approved' AND reviewed_at > v_7d_ago;

  SELECT COUNT(*) INTO v_pending_pay
  FROM public.manual_payments WHERE status = 'pending';

  -- ── Daily signups (last 30 days) ─────────────────────────
  SELECT jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day)
    INTO v_signups_daily
  FROM (
    SELECT DATE(created_at) AS day, COUNT(*) AS cnt
    FROM auth.users
    WHERE created_at > v_30d_ago
    GROUP BY 1
  ) s;

  -- ── Daily active users (last 30 days) ────────────────────
  SELECT jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day)
    INTO v_activity_daily
  FROM (
    SELECT DATE(created_at) AS day, COUNT(DISTINCT actor_user_id) AS cnt
    FROM public.activity_logs
    WHERE created_at > v_30d_ago AND actor_user_id IS NOT NULL
    GROUP BY 1
  ) a;

  -- ── Daily installs (last 30 days) ────────────────────────
  BEGIN
    SELECT jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day)
      INTO v_installs_daily
    FROM (
      SELECT DATE(created_at) AS day, COUNT(*) AS cnt
      FROM public.push_subscriptions
      WHERE created_at > v_30d_ago
      GROUP BY 1
    ) i;
  EXCEPTION WHEN OTHERS THEN
    v_installs_daily := '[]'::jsonb;
  END;

  -- ── Daily revenue (last 30 days) ─────────────────────────
  SELECT jsonb_agg(jsonb_build_object('day', day, 'amount', amt) ORDER BY day)
    INTO v_revenue_daily
  FROM (
    SELECT DATE(reviewed_at) AS day, COALESCE(SUM(amount_pkr), 0) AS amt
    FROM public.manual_payments
    WHERE status = 'approved' AND reviewed_at > v_30d_ago
    GROUP BY 1
  ) r;

  -- ── Plan distribution ────────────────────────────────────
  SELECT jsonb_agg(jsonb_build_object('plan', plan_name, 'count', cnt) ORDER BY cnt DESC)
    INTO v_plan_dist
  FROM (
    SELECT p.name AS plan_name, COUNT(*) AS cnt
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE us.status = 'active'
    GROUP BY p.name
  ) pd;

  -- ── Top 5 users (by activity in last 30 days) ────────────
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'name',    full_name,
      'email',   email,
      'actions', actions
    ) ORDER BY actions DESC
  ) INTO v_top_users
  FROM (
    SELECT al.actor_user_id AS user_id,
           COALESCE(p.full_name, split_part(p.email, '@', 1)) AS full_name,
           p.email,
           COUNT(*) AS actions
    FROM public.activity_logs al
    LEFT JOIN public.profiles p ON p.id = al.actor_user_id
    WHERE al.created_at > v_30d_ago AND al.actor_user_id IS NOT NULL
    GROUP BY al.actor_user_id, p.full_name, p.email
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'users', jsonb_build_object(
      'total',       v_total_users,
      'new_24h',     v_new_24h,
      'new_7d',      v_new_7d,
      'new_30d',     v_new_30d,
      'online_now',  v_online_now,
      'dau',         v_dau,
      'wau',         v_wau,
      'mau',         v_mau
    ),
    'installs', jsonb_build_object(
      'android', v_android,
      'ios',     v_ios,
      'web',     v_web_push
    ),
    'content', jsonb_build_object(
      'total_quizzes',      v_total_quizzes,
      'quizzes_24h',        v_quizzes_24h,
      'quizzes_7d',         v_quizzes_7d,
      'total_questions',    v_total_questions,
      'total_participants', v_total_participants,
      'ai_calls_7d',        v_ai_calls_7d,
      'ai_cost_7d_usd',     v_ai_cost_7d
    ),
    'revenue', jsonb_build_object(
      'total_pkr',   v_revenue_total,
      'last_7d_pkr', v_revenue_7d,
      'pending',     v_pending_pay
    ),
    'series', jsonb_build_object(
      'signups',  COALESCE(v_signups_daily,  '[]'::jsonb),
      'activity', COALESCE(v_activity_daily, '[]'::jsonb),
      'installs', COALESCE(v_installs_daily, '[]'::jsonb),
      'revenue',  COALESCE(v_revenue_daily,  '[]'::jsonb)
    ),
    'plans',     COALESCE(v_plan_dist,  '[]'::jsonb),
    'top_users', COALESCE(v_top_users,  '[]'::jsonb),
    'generated_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_analytics() TO authenticated;
