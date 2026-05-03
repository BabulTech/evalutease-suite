-- =====================================================================
-- Categories ↔ sub-categories, participant types ↔ sub-types, invites,
-- per-question time, session-level participant subtype roster.
-- Idempotent — safe to re-run.
-- =====================================================================

-- ===== QUESTION SUB-CATEGORIES =====
CREATE TABLE IF NOT EXISTS public.question_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.question_categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.question_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages subcategories" ON public.question_subcategories;
CREATE POLICY "Owner manages subcategories" ON public.question_subcategories
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_question_subcategories_category
  ON public.question_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_question_subcategories_owner
  ON public.question_subcategories(owner_id);

-- ===== QUESTION_CATEGORIES.icon =====
ALTER TABLE public.question_categories
  ADD COLUMN IF NOT EXISTS icon TEXT NULL;

-- ===== QUESTIONS: subcategory + per-question time =====
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.question_subcategories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_seconds INTEGER NOT NULL DEFAULT 10;

CREATE INDEX IF NOT EXISTS idx_questions_subcategory
  ON public.questions(subcategory_id);

-- ===== PARTICIPANT TYPES =====
CREATE TABLE IF NOT EXISTS public.participant_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages participant types" ON public.participant_types;
CREATE POLICY "Owner manages participant types" ON public.participant_types
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_participant_types_owner
  ON public.participant_types(owner_id);

-- ===== PARTICIPANT SUB-TYPES =====
CREATE TABLE IF NOT EXISTS public.participant_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type_id UUID REFERENCES public.participant_types(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_subtypes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages participant subtypes" ON public.participant_subtypes;
CREATE POLICY "Owner manages participant subtypes" ON public.participant_subtypes
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_participant_subtypes_type
  ON public.participant_subtypes(type_id);
CREATE INDEX IF NOT EXISTS idx_participant_subtypes_owner
  ON public.participant_subtypes(owner_id);

-- ===== PARTICIPANTS: subtype link =====
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS subtype_id UUID REFERENCES public.participant_subtypes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_participants_subtype
  ON public.participants(subtype_id);

-- ===== QUIZ SESSIONS: subcategory link =====
ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.question_subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_subcategory
  ON public.quiz_sessions(subcategory_id);

-- ===== QUIZ_SESSION_SUBTYPES (M:N session ↔ subtype roster) =====
CREATE TABLE IF NOT EXISTS public.quiz_session_subtypes (
  session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  subtype_id UUID REFERENCES public.participant_subtypes(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (session_id, subtype_id)
);
ALTER TABLE public.quiz_session_subtypes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages session subtypes" ON public.quiz_session_subtypes;
CREATE POLICY "Owner manages session subtypes" ON public.quiz_session_subtypes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  );

-- ===== PARTICIPANT INVITES (copy-link redemption) =====
CREATE TABLE IF NOT EXISTS public.participant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subtype_id UUID REFERENCES public.participant_subtypes(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
ALTER TABLE public.participant_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own invites" ON public.participant_invites;
CREATE POLICY "Owner manages own invites" ON public.participant_invites
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Anon can read by token (the public landing page resolves the invite via this select).
DROP POLICY IF EXISTS "Anon reads invite by token" ON public.participant_invites;
CREATE POLICY "Anon reads invite by token" ON public.participant_invites
  FOR SELECT TO anon, authenticated USING (TRUE);
-- Note: token is a non-guessable UUID. RLS still allows row-level read; the public RPC below is what
-- the front-end actually uses, so the SELECT policy is permissive but harmless.

CREATE INDEX IF NOT EXISTS idx_participant_invites_owner
  ON public.participant_invites(owner_id);
CREATE INDEX IF NOT EXISTS idx_participant_invites_subtype
  ON public.participant_invites(subtype_id);

-- ===== get_invite_for_token =====
-- Public RPC that returns the type/subtype names + owner_id for the landing page.
CREATE OR REPLACE FUNCTION public.get_invite_for_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite participant_invites;
  v_sub participant_subtypes;
  v_type participant_types;
BEGIN
  SELECT * INTO v_invite FROM participant_invites WHERE token = p_token;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_sub FROM participant_subtypes WHERE id = v_invite.subtype_id;
  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object('error', 'subtype_missing');
  END IF;

  SELECT * INTO v_type FROM participant_types WHERE id = v_sub.type_id;

  RETURN jsonb_build_object(
    'invite', jsonb_build_object(
      'id',     v_invite.id,
      'status', v_invite.status,
      'email',  v_invite.email
    ),
    'type',    jsonb_build_object('id', v_type.id, 'name', v_type.name, 'icon', v_type.icon),
    'subtype', jsonb_build_object('id', v_sub.id,  'name', v_sub.name)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_for_token(TEXT) TO anon, authenticated;

-- ===== redeem_participant_invite =====
-- Anon RPC: writes a participants row under the invite's owner & subtype, then
-- flips the invite to 'accepted'. One-shot (re-runs return already_redeemed).
CREATE OR REPLACE FUNCTION public.redeem_participant_invite(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_mobile TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite participant_invites;
  v_participant_id UUID;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;

  SELECT * INTO v_invite FROM participant_invites WHERE token = p_token;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('error', 'already_redeemed');
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

  UPDATE participant_invites
  SET status = 'accepted',
      accepted_at = now(),
      accepted_participant_id = v_participant_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_participant_invite(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ===== BACKFILL EXISTING DATA =====

-- 1. For every existing question_categories row, create a default "General" sub-category.
INSERT INTO public.question_subcategories (owner_id, category_id, name)
SELECT c.owner_id, c.id, 'General'
FROM public.question_categories c
WHERE NOT EXISTS (
  SELECT 1 FROM public.question_subcategories s WHERE s.category_id = c.id
);

-- 2. Move existing questions into the auto-created "General" sub-category.
UPDATE public.questions q
SET subcategory_id = (
  SELECT id FROM public.question_subcategories s
  WHERE s.category_id = q.category_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE q.subcategory_id IS NULL AND q.category_id IS NOT NULL;

-- 3. Per-owner default participant_type "General" + default sub-type "General"; assign existing participants.
DO $$
DECLARE
  rec RECORD;
  v_type_id UUID;
  v_sub_id UUID;
BEGIN
  FOR rec IN SELECT DISTINCT owner_id FROM public.participants LOOP
    -- Pick or create default type
    SELECT id INTO v_type_id
    FROM public.participant_types
    WHERE owner_id = rec.owner_id AND name = 'General'
    LIMIT 1;

    IF v_type_id IS NULL THEN
      INSERT INTO public.participant_types (owner_id, name, icon)
      VALUES (rec.owner_id, 'General', 'users')
      RETURNING id INTO v_type_id;
    END IF;

    -- Pick or create default sub-type
    SELECT id INTO v_sub_id
    FROM public.participant_subtypes
    WHERE owner_id = rec.owner_id AND type_id = v_type_id AND name = 'General'
    LIMIT 1;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.participant_subtypes (owner_id, type_id, name)
      VALUES (rec.owner_id, v_type_id, 'General')
      RETURNING id INTO v_sub_id;
    END IF;

    -- Backfill participants.subtype_id where missing
    UPDATE public.participants
    SET subtype_id = v_sub_id
    WHERE owner_id = rec.owner_id AND subtype_id IS NULL;
  END LOOP;
END $$;

-- 4. Existing sessions with category_id but no subcategory_id → first sub-category in that category.
UPDATE public.quiz_sessions ss
SET subcategory_id = (
  SELECT id FROM public.question_subcategories
  WHERE category_id = ss.category_id
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE ss.subcategory_id IS NULL AND ss.category_id IS NOT NULL;

-- ===== Tell PostgREST to reload the schema cache so the new FKs are usable from the front-end. =====
NOTIFY pgrst, 'reload schema';
