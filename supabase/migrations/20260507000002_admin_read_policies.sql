-- ============================================================
-- Admin read-all policies for every table the admin dashboard
-- needs to query across users (bypasses owner_id = auth.uid() filters).
-- All existing user-owned policies remain intact.
-- ============================================================

-- profiles
create policy "Admins read all profiles"
  on public.profiles for select
  using (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "Admins read all user_roles"
  on public.user_roles for select
  using (public.has_role(auth.uid(), 'admin'));

-- quiz_sessions
create policy "Admins read all quiz_sessions"
  on public.quiz_sessions for select
  using (public.has_role(auth.uid(), 'admin'));

-- quiz_attempts
create policy "Admins read all quiz_attempts"
  on public.quiz_attempts for select
  using (public.has_role(auth.uid(), 'admin'));

-- quiz_answers
create policy "Admins read all quiz_answers"
  on public.quiz_answers for select
  using (public.has_role(auth.uid(), 'admin'));

-- quiz_session_questions
create policy "Admins read all quiz_session_questions"
  on public.quiz_session_questions for select
  using (public.has_role(auth.uid(), 'admin'));

-- questions
create policy "Admins read all questions"
  on public.questions for select
  using (public.has_role(auth.uid(), 'admin'));

-- question_categories
create policy "Admins read all question_categories"
  on public.question_categories for select
  using (public.has_role(auth.uid(), 'admin'));

-- question_subcategories
create policy "Admins read all question_subcategories"
  on public.question_subcategories for select
  using (public.has_role(auth.uid(), 'admin'));

-- participants
create policy "Admins read all participants"
  on public.participants for select
  using (public.has_role(auth.uid(), 'admin'));

-- participant_types
create policy "Admins read all participant_types"
  on public.participant_types for select
  using (public.has_role(auth.uid(), 'admin'));

-- participant_subtypes
create policy "Admins read all participant_subtypes"
  on public.participant_subtypes for select
  using (public.has_role(auth.uid(), 'admin'));

-- participant_invites
create policy "Admins read all participant_invites"
  on public.participant_invites for select
  using (public.has_role(auth.uid(), 'admin'));

-- host_settings
create policy "Admins read all host_settings"
  on public.host_settings for select
  using (public.has_role(auth.uid(), 'admin'));

-- quiz_feedback (already has host-read policy; add admin)
create policy "Admins read all quiz_feedback"
  on public.quiz_feedback for select
  using (public.has_role(auth.uid(), 'admin'));
