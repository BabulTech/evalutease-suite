-- ============================================================
-- Drop conflicting triggers that were overwriting handle_new_user
-- assign_starter_plan() and auto_assign_free_plan() both ran
-- AFTER handle_new_user and reset every user to individual_starter.
-- handle_new_user() alone now handles plan assignment correctly.
-- ============================================================

DROP TRIGGER IF EXISTS on_new_user_assign_free_plan ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_plan ON auth.users;
