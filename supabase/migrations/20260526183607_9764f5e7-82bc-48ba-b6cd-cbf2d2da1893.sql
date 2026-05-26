
-- meeting_availability
CREATE TABLE public.meeting_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_availability TO authenticated;
GRANT ALL ON public.meeting_availability TO service_role;
ALTER TABLE public.meeting_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY ma_select_own ON public.meeting_availability FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ma_insert_own ON public.meeting_availability FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ma_update_own ON public.meeting_availability FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ma_delete_own ON public.meeting_availability FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER ma_touch BEFORE UPDATE ON public.meeting_availability FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ma_user_idx ON public.meeting_availability(user_id);

-- meeting_booking_tokens
CREATE TABLE public.meeting_booking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_booking_tokens TO authenticated;
GRANT ALL ON public.meeting_booking_tokens TO service_role;
ALTER TABLE public.meeting_booking_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY mbt_select_own ON public.meeting_booking_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY mbt_insert_own ON public.meeting_booking_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY mbt_update_own ON public.meeting_booking_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY mbt_delete_own ON public.meeting_booking_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- dropin_tokens
CREATE TABLE public.dropin_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropin_tokens TO authenticated;
GRANT ALL ON public.dropin_tokens TO service_role;
ALTER TABLE public.dropin_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY dt_select_own ON public.dropin_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dt_insert_own ON public.dropin_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY dt_update_own ON public.dropin_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dt_delete_own ON public.dropin_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- meetings
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text NOT NULL,
  client_email text,
  note text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'upcoming',
  source text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY meetings_select_own ON public.meetings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY meetings_insert_own ON public.meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY meetings_update_own ON public.meetings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY meetings_delete_own ON public.meetings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER meetings_touch BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX meetings_user_idx ON public.meetings(user_id, scheduled_at);

CREATE OR REPLACE FUNCTION public.validate_meeting()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('upcoming','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.source NOT IN ('scheduled','dropin') THEN
    RAISE EXCEPTION 'Invalid source: %', NEW.source;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER meetings_validate BEFORE INSERT OR UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.validate_meeting();

-- dropin_requests
CREATE TABLE public.dropin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropin_requests TO authenticated;
GRANT ALL ON public.dropin_requests TO service_role;
ALTER TABLE public.dropin_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY dr_select_own ON public.dropin_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dr_insert_own ON public.dropin_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY dr_update_own ON public.dropin_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dr_delete_own ON public.dropin_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER dr_touch BEFORE UPDATE ON public.dropin_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX dr_user_idx ON public.dropin_requests(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_dropin()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending','accepted','declined') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER dr_validate BEFORE INSERT OR UPDATE ON public.dropin_requests FOR EACH ROW EXECUTE FUNCTION public.validate_dropin();

-- meeting_notes
CREATE TABLE public.meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meeting_id uuid,
  project_id uuid,
  title text NOT NULL,
  meeting_date date,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  share_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_notes TO authenticated;
GRANT ALL ON public.meeting_notes TO service_role;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mn_select_own ON public.meeting_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY mn_insert_own ON public.meeting_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY mn_update_own ON public.meeting_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY mn_delete_own ON public.meeting_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER mn_touch BEFORE UPDATE ON public.meeting_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX mn_user_idx ON public.meeting_notes(user_id, meeting_date DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dropin_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;

-- Permissions: meetings page allowed for all existing roles by default
INSERT INTO public.role_page_permissions(role, page, allowed) VALUES
  ('admin','meetings',true),
  ('user','meetings',true),
  ('marketing','meetings',true)
ON CONFLICT DO NOTHING;
