DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.challenges REPLICA IDENTITY FULL;