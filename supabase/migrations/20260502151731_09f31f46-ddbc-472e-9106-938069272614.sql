
-- ===== ROLES (separate table for security) =====
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT,
  mobile TEXT,
  organization TEXT,
  preferred_language TEXT DEFAULT 'en',
  country TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ===== AUTO-CREATE PROFILE + ROLE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== QUESTION CATEGORIES =====
CREATE TABLE public.question_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages categories" ON public.question_categories
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ===== QUESTIONS =====
CREATE TYPE public.question_type AS ENUM ('mcq', 'true_false', 'short_answer');
CREATE TYPE public.difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE public.question_source AS ENUM ('manual', 'ai', 'ocr', 'import');

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.question_categories(id) ON DELETE SET NULL,
  subject TEXT,
  topic TEXT,
  text TEXT NOT NULL,
  type question_type NOT NULL DEFAULT 'mcq',
  difficulty difficulty NOT NULL DEFAULT 'medium',
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  explanation TEXT,
  source question_source NOT NULL DEFAULT 'manual',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages questions" ON public.questions
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER questions_touch BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== PARTICIPANTS =====
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  mobile TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages participants" ON public.participants
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.participant_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages groups" ON public.participant_groups
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.participant_group_members (
  group_id UUID REFERENCES public.participant_groups(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (group_id, participant_id)
);
ALTER TABLE public.participant_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages group members" ON public.participant_group_members
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.participant_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.participant_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- ===== QUIZ SESSIONS =====
CREATE TYPE public.session_mode AS ENUM ('live', 'qr_link');
CREATE TYPE public.session_status AS ENUM ('draft', 'scheduled', 'active', 'completed', 'expired');

CREATE TABLE public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  description TEXT,
  language TEXT DEFAULT 'en',
  mode session_mode NOT NULL DEFAULT 'live',
  status session_status NOT NULL DEFAULT 'draft',
  default_time_per_question INTEGER DEFAULT 30,
  access_code TEXT UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages sessions" ON public.quiz_sessions
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
-- Anyone (including anonymous) can read an open QR/link session by knowing its code
CREATE POLICY "Public can view open qr sessions" ON public.quiz_sessions
  FOR SELECT TO anon, authenticated USING (mode = 'qr_link' AND is_open = TRUE);

CREATE TRIGGER sessions_touch BEFORE UPDATE ON public.quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.quiz_session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  time_seconds INTEGER,
  UNIQUE (session_id, question_id)
);
ALTER TABLE public.quiz_session_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages session questions" ON public.quiz_session_questions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  );

CREATE TABLE public.quiz_session_participants (
  session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (session_id, participant_id)
);
ALTER TABLE public.quiz_session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages session participants" ON public.quiz_session_participants
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  );

-- ===== QUIZ ATTEMPTS & ANSWERS =====
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  participant_name TEXT,
  participant_email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session owner views attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  );
CREATE POLICY "Public can create attempts on open sessions" ON public.quiz_attempts
  FOR INSERT TO anon, authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.is_open = TRUE)
  );
CREATE POLICY "Users update their own attempts" ON public.quiz_attempts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  answer TEXT,
  is_correct BOOLEAN,
  time_taken_seconds INTEGER,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session owner views answers" ON public.quiz_answers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts a
      JOIN public.quiz_sessions s ON s.id = a.session_id
      WHERE a.id = attempt_id AND s.owner_id = auth.uid()
    )
  );
CREATE POLICY "Public can insert answers on open sessions" ON public.quiz_answers
  FOR INSERT TO anon, authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts a
      JOIN public.quiz_sessions s ON s.id = a.session_id
      WHERE a.id = attempt_id AND s.is_open = TRUE
    )
  );

-- Indexes
CREATE INDEX idx_questions_owner ON public.questions(owner_id);
CREATE INDEX idx_questions_subject ON public.questions(subject);
CREATE INDEX idx_participants_owner ON public.participants(owner_id);
CREATE INDEX idx_sessions_owner ON public.quiz_sessions(owner_id);
CREATE INDEX idx_sessions_access_code ON public.quiz_sessions(access_code);
CREATE INDEX idx_attempts_session ON public.quiz_attempts(session_id);
