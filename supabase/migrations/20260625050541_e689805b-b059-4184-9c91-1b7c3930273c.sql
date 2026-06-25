
-- ============ ENUMS ============
CREATE TYPE public.task_priority AS ENUM ('low','medium','high');
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','done');
CREATE TYPE public.idea_status AS ENUM ('new','exploring','converted','archived');
CREATE TYPE public.plan_status AS ENUM ('draft','active','completed','paused');
CREATE TYPE public.challenge_status AS ENUM ('active','completed','failed');
CREATE TYPE public.theme_pref AS ENUM ('dark','light','system');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  theme public.theme_pref NOT NULL DEFAULT 'dark',
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ tasks ============
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  due_date timestamptz,
  completed_at timestamptz,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks all" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_tasks_user_due ON public.tasks(user_id, due_date);
CREATE INDEX idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX idx_tasks_parent ON public.tasks(parent_id);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ideas ============
CREATE TABLE public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  tag text DEFAULT 'general',
  status public.idea_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideas TO authenticated;
GRANT ALL ON public.ideas TO service_role;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ideas all" ON public.ideas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ideas_user_status ON public.ideas(user_id, status);
CREATE TRIGGER trg_ideas_updated BEFORE UPDATE ON public.ideas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ plans ============
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea_id uuid REFERENCES public.ideas(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status public.plan_status NOT NULL DEFAULT 'draft',
  target_date date,
  progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plans all" ON public.plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_plans_user_status ON public.plans(user_id, status);
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ challenges ============
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deadline timestamptz NOT NULL,
  status public.challenge_status NOT NULL DEFAULT 'active',
  priority public.task_priority NOT NULL DEFAULT 'high',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenges all" ON public.challenges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_challenges_user_deadline ON public.challenges(user_id, deadline);
CREATE TRIGGER trg_challenges_updated BEFORE UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ challenge_reminders ============
CREATE TABLE public.challenge_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_reminders TO authenticated;
GRANT ALL ON public.challenge_reminders TO service_role;
ALTER TABLE public.challenge_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders all" ON public.challenge_reminders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_reminders_sched ON public.challenge_reminders(user_id, scheduled_for) WHERE sent_at IS NULL;

-- ============ handle_new_user (profile + seed demo data) ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_idea_id uuid;
  new_challenge_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- seed tasks
  INSERT INTO public.tasks (user_id, title, description, category, priority, due_date) VALUES
    (NEW.id, 'WeboGrowth-এ স্বাগতম! 👋', 'এই sample task-গুলো ঘুরে দেখুন, তারপর নিজের প্রথম টাস্ক যোগ করুন।', 'onboarding', 'high', now() + interval '1 day'),
    (NEW.id, 'Webogrowth.com-এর জন্য আজকের কাজ লিখুন', 'ছোট, পরিষ্কার, actionable টাস্ক ভাঙুন।', 'work', 'medium', now() + interval '2 day'),
    (NEW.id, 'একটা নতুন আইডিয়া capture করুন', 'মাথায় ঘোরা যেকোনো গ্রোথ আইডিয়া Ideas-এ লিখে ফেলুন।', 'growth', 'low', now() + interval '3 day');

  -- seed idea
  INSERT INTO public.ideas (user_id, title, content, tag, status)
  VALUES (NEW.id, 'Webogrowth blog series', 'সপ্তাহে ১টা SEO-optimized পোস্ট publish — 12 weeks plan।', 'content', 'new')
  RETURNING id INTO new_idea_id;

  -- seed challenge (5 days from now)
  INSERT INTO public.challenges (user_id, title, description, deadline, priority)
  VALUES (NEW.id, '৫ দিনের লঞ্চ চ্যালেঞ্জ', 'Webogrowth Planner-এর প্রথম ফিচার রিলিজ করুন।', now() + interval '5 day', 'high')
  RETURNING id INTO new_challenge_id;

  -- seed reminders (escalating)
  INSERT INTO public.challenge_reminders (challenge_id, user_id, scheduled_for, message) VALUES
    (new_challenge_id, NEW.id, now() + interval '5 day' - interval '48 hour', '48 ঘণ্টা বাকি — পরিকল্পনা চূড়ান্ত করুন।'),
    (new_challenge_id, NEW.id, now() + interval '5 day' - interval '24 hour', '24 ঘণ্টা বাকি — final push!'),
    (new_challenge_id, NEW.id, now() + interval '5 day' - interval '6 hour',  '6 ঘণ্টা বাকি — শেষ স্প্রিন্ট!');

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- enable realtime for live sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
