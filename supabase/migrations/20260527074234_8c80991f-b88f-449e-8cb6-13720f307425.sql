
-- 1) Username on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2) meeting_url on meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meeting_url text;

-- 3) Per-user meeting settings
CREATE TABLE IF NOT EXISTS public.meeting_settings (
  user_id uuid PRIMARY KEY,
  video_provider text NOT NULL DEFAULT 'jitsi',
  custom_link_template text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_settings TO authenticated;
GRANT ALL ON public.meeting_settings TO service_role;

ALTER TABLE public.meeting_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ms_select_own ON public.meeting_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ms_insert_own ON public.meeting_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ms_update_own ON public.meeting_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ms_delete_own ON public.meeting_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4) Realtime for meetings
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
