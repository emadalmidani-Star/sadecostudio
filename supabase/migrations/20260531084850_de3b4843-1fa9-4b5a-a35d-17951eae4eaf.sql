
-- =========================
-- Email Marketing schema
-- =========================

-- Contacts
CREATE TABLE public.email_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'subscribed', -- subscribed|unsubscribed|bounced|complained
  source text NOT NULL DEFAULT 'manual',     -- manual|csv|lead|api
  source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  lead_id uuid,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_contacts TO authenticated;
GRANT ALL ON public.email_contacts TO service_role;
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ec_select ON public.email_contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ec_insert ON public.email_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ec_update ON public.email_contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ec_delete ON public.email_contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ec_user_idx ON public.email_contacts(user_id);
CREATE INDEX ec_status_idx ON public.email_contacts(user_id, status);

-- Lists
CREATE TABLE public.email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_lists TO authenticated;
GRANT ALL ON public.email_lists TO service_role;
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY el_all ON public.email_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- List members
CREATE TABLE public.email_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_list_members TO authenticated;
GRANT ALL ON public.email_list_members TO service_role;
ALTER TABLE public.email_list_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY elm_all ON public.email_list_members FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  preset text NOT NULL DEFAULT 'brand', -- brand|minimal
  subject text NOT NULL DEFAULT '',
  preheader text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY et_all ON public.email_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Campaigns
CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  list_id uuid REFERENCES public.email_lists(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  preheader text,
  from_name text,
  status text NOT NULL DEFAULT 'draft', -- draft|scheduled|sending|sent|failed|cancelled
  scheduled_for timestamptz,
  sent_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{"recipients":0,"sent":0,"delivered":0,"opened":0,"clicked":0,"bounced":0,"unsubscribed":0,"complained":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY ecm_all ON public.email_campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ecm_sched_idx ON public.email_campaigns(status, scheduled_for);

-- Sends (per campaign per contact)
CREATE TABLE public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  automation_run_id uuid,
  contact_id uuid REFERENCES public.email_contacts(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  message_id text,
  status text NOT NULL DEFAULT 'queued', -- queued|sent|failed|delivered|bounced|complained
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_sends TO authenticated;
GRANT ALL ON public.email_sends TO service_role;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY es_all ON public.email_sends FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX es_camp_idx ON public.email_sends(campaign_id);
CREATE INDEX es_msg_idx ON public.email_sends(message_id);

-- Automations
CREATE TABLE public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  trigger text NOT NULL,        -- lead_created|booking_created|contact_added|tag_added|list_added
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'paused', -- active|paused
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_automations TO authenticated;
GRANT ALL ON public.email_automations TO service_role;
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ea_all ON public.email_automations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Automation steps
CREATE TABLE public.email_automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 0,
  delay_minutes int NOT NULL DEFAULT 0,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_automation_steps TO authenticated;
GRANT ALL ON public.email_automation_steps TO service_role;
ALTER TABLE public.email_automation_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY eas_all ON public.email_automation_steps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Automation runs (one per contact per automation)
CREATE TABLE public.email_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  current_step int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active', -- active|completed|cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(automation_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_automation_runs TO authenticated;
GRANT ALL ON public.email_automation_runs TO service_role;
ALTER TABLE public.email_automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ear_all ON public.email_automation_runs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ear_next_idx ON public.email_automation_runs(status, next_run_at);

-- Marketing sender settings (per user)
CREATE TABLE public.email_marketing_settings (
  user_id uuid PRIMARY KEY,
  from_name text,
  from_email text,
  reply_to text,
  physical_address text,
  resend_audience_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_marketing_settings TO authenticated;
GRANT ALL ON public.email_marketing_settings TO service_role;
ALTER TABLE public.email_marketing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ems_all ON public.email_marketing_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Unsubscribe tokens (public-resolvable)
CREATE TABLE public.email_unsubs (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_unsubs TO authenticated;
GRANT ALL ON public.email_unsubs TO service_role;
ALTER TABLE public.email_unsubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY eu_owner ON public.email_unsubs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email events (webhook log)
CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  send_id uuid REFERENCES public.email_sends(id) ON DELETE CASCADE,
  message_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ee_owner ON public.email_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER ec_touch BEFORE UPDATE ON public.email_contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER el_touch BEFORE UPDATE ON public.email_lists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER et_touch BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ecm_touch BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ea_touch BEFORE UPDATE ON public.email_automations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ear_touch BEFORE UPDATE ON public.email_automation_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ems_touch BEFORE UPDATE ON public.email_marketing_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-sync: when a lead is inserted/updated, upsert a matching email_contact
CREATE OR REPLACE FUNCTION public.sync_lead_to_email_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN RETURN NEW; END IF;
  INSERT INTO public.email_contacts (user_id, email, name, source, source_meta, lead_id, tags)
  VALUES (
    NEW.user_id,
    lower(NEW.email),
    coalesce(NEW.name, NEW.email),
    'lead',
    jsonb_build_object('lead_source', NEW.source, 'stage', NEW.stage),
    NEW.id,
    ARRAY['lead', 'source:' || NEW.source, 'stage:' || NEW.stage]
  )
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = COALESCE(public.email_contacts.name, EXCLUDED.name),
        lead_id = COALESCE(public.email_contacts.lead_id, EXCLUDED.lead_id),
        tags = (
          SELECT ARRAY(SELECT DISTINCT unnest(public.email_contacts.tags || EXCLUDED.tags))
        ),
        updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER leads_sync_to_email_contact
AFTER INSERT OR UPDATE OF email, stage, name ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_to_email_contact();

-- Add new page to permissions registry by seeding rows
INSERT INTO public.role_page_permissions (role, page, allowed) VALUES
  ('admin','email_marketing',true),
  ('marketing','email_marketing',true),
  ('user','email_marketing',false)
ON CONFLICT DO NOTHING;
