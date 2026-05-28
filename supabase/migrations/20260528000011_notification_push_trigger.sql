-- ============================================================
-- When a row lands in public.notifications, fire the send-push
-- Edge Function so every active push subscription for that user
-- gets a real OS-level notification.
--
-- Requires pg_net extension (preinstalled on Supabase).
-- Reads project URL + service-role key from Vault secrets.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public._send_push_for_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_url TEXT;
  v_anon_key    TEXT;
BEGIN
  -- Read from Vault. If secrets aren't configured, exit silently — the
  -- in-app bell still works; only OS-level pushes are skipped.
  BEGIN
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;

    SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_project_url IS NULL OR v_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Async HTTP call — pg_net returns a request_id immediately
  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'title',   NEW.title,
      'body',    NEW.body,
      'link',    NEW.link,
      'type',    NEW.type
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block the notification insert
END;
$$;

DROP TRIGGER IF EXISTS trg_send_push_for_notification ON public.notifications;
CREATE TRIGGER trg_send_push_for_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public._send_push_for_notification();
