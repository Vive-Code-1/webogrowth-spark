
DROP POLICY IF EXISTS "Users manage own activity" ON public.activity_log;
CREATE POLICY "Users manage own activity" ON public.activity_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
