
-- work_sessions
CREATE TABLE public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  work_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  dashboard_minutes integer NOT NULL DEFAULT 0,
  total_minutes integer NOT NULL DEFAULT 0,
  td_account text,
  project_name text,
  project_url text,
  notes text,
  is_running boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_sessions TO authenticated;
GRANT ALL ON public.work_sessions TO service_role;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own work_sessions all" ON public.work_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER work_sessions_updated_at BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX work_sessions_user_date_idx ON public.work_sessions (user_id, work_date DESC);

-- transactions
CREATE TYPE public.txn_type AS ENUM ('income', 'expense');
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  txn_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  type public.txn_type NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  category text NOT NULL DEFAULT 'general',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions all" ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX transactions_user_date_idx ON public.transactions (user_id, txn_date DESC);

-- daily_targets
CREATE TABLE public.daily_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  target_hours numeric(5,2) NOT NULL DEFAULT 8,
  target_tasks integer NOT NULL DEFAULT 3,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_targets TO authenticated;
GRANT ALL ON public.daily_targets TO service_role;
ALTER TABLE public.daily_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily_targets all" ON public.daily_targets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER daily_targets_updated_at BEFORE UPDATE ON public.daily_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
