-- Admin: delete a single activity log entry
CREATE OR REPLACE FUNCTION public.admin_delete_activity_log(p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.activity_logs WHERE id = p_id;
END;
$$;

-- Admin: bulk delete activity log entries
CREATE OR REPLACE FUNCTION public.admin_delete_activity_logs(p_ids UUID[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.activity_logs WHERE id = ANY(p_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_activity_log(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_activity_logs(UUID[]) TO authenticated;
