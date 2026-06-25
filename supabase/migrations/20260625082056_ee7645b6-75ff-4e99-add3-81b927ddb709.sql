CREATE OR REPLACE FUNCTION public.purge_yearly_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := date_trunc('year', now());
BEGIN
  DELETE FROM public.activity_log         WHERE created_at < cutoff;
  DELETE FROM public.challenge_reminders  WHERE created_at < cutoff;
  DELETE FROM public.challenges           WHERE created_at < cutoff;
  DELETE FROM public.tasks                WHERE created_at < cutoff;
  DELETE FROM public.ideas                WHERE created_at < cutoff;
  DELETE FROM public.plans                WHERE created_at < cutoff;
  DELETE FROM public.work_sessions        WHERE created_at < cutoff;
  DELETE FROM public.transactions         WHERE created_at < cutoff;
  DELETE FROM public.daily_targets        WHERE created_at < cutoff;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_yearly_data() FROM PUBLIC, anon, authenticated;