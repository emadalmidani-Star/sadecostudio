
-- ============ WhatsApp Messaging Suite ============

-- Sender config (one row per user — single business number for v1)
CREATE TABLE public.whatsapp_sender_config (
  user_id uuid PRIMARY KEY,
  phone_number_id text,
  waba_id text,
  display_phone text,
  display_name text,
  quality_rating text,
  verify_token text NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),
  status text NOT NULL DEFAULT 'disconnected',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sender_config TO authenticated;
GRANT ALL ON public.whatsapp_sender_config TO service_role;
ALTER TABLE public.whatsapp_sender_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY wsc_all ON public.whatsapp_sender_config FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Approved templates synced from Meta
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  category text,
  status text NOT NULL DEFAULT 'PENDING',
  body text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY wt_all ON public.whatsapp_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Contacts (phone-based, E.164 without '+')
CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'subscribed',
  tags text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'manual',
  source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  lead_id uuid,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contacts TO authenticated;
GRANT ALL ON public.whatsapp_contacts TO service_role;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY wc_all ON public.whatsapp_contacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.whatsapp_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_lists TO authenticated;
GRANT ALL ON public.whatsapp_lists TO service_role;
ALTER TABLE public.whatsapp_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY wl_all ON public.whatsapp_lists FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.whatsapp_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  list_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_list_members TO authenticated;
GRANT ALL ON public.whatsapp_list_members TO service_role;
ALTER TABLE public.whatsapp_list_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY wlm_all ON public.whatsapp_list_members FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Campaigns
CREATE TABLE public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  list_id uuid,
  template_id uuid,
  template_name text,
  template_language text DEFAULT 'en',
  variables_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{"recipients":0,"sent":0,"delivered":0,"read":0,"failed":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_campaigns TO authenticated;
GRANT ALL ON public.whatsapp_campaigns TO service_role;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY wcmp_all ON public.whatsapp_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-recipient sends (also used by automations & 1-1)
CREATE TABLE public.whatsapp_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid,
  automation_run_id uuid,
  contact_id uuid,
  recipient_phone text NOT NULL,
  wa_message_id text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sends TO authenticated;
GRANT ALL ON public.whatsapp_sends TO service_role;
ALTER TABLE public.whatsapp_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_all ON public.whatsapp_sends FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_wa_sends_msgid ON public.whatsapp_sends(wa_message_id);

-- Automations
CREATE TABLE public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  trigger text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'paused',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automations TO authenticated;
GRANT ALL ON public.whatsapp_automations TO service_role;
ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_all ON public.whatsapp_automations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.whatsapp_automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  step_order int NOT NULL DEFAULT 0,
  delay_minutes int NOT NULL DEFAULT 0,
  template_id uuid,
  template_name text,
  template_language text DEFAULT 'en',
  variables_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automation_steps TO authenticated;
GRANT ALL ON public.whatsapp_automation_steps TO service_role;
ALTER TABLE public.whatsapp_automation_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY was_all ON public.whatsapp_automation_steps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.whatsapp_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  current_step int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automation_runs TO authenticated;
GRANT ALL ON public.whatsapp_automation_runs TO service_role;
ALTER TABLE public.whatsapp_automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY war_all ON public.whatsapp_automation_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 1-to-1 inbox: conversations + messages
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid,
  phone text NOT NULL,
  display_name text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_inbound_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY wconv_all ON public.whatsapp_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid,
  direction text NOT NULL,
  wa_message_id text,
  body text,
  media_url text,
  media_type text,
  template_name text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY wmsg_all ON public.whatsapp_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id, created_at DESC);

-- Personal "click-to-chat" snippet library (per-user)
CREATE TABLE public.whatsapp_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_snippets TO authenticated;
GRANT ALL ON public.whatsapp_snippets TO service_role;
ALTER TABLE public.whatsapp_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY wsn_all ON public.whatsapp_snippets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notification settings (which system events auto-send WhatsApp)
CREATE TABLE public.whatsapp_notification_settings (
  user_id uuid PRIMARY KEY,
  booking_confirm_enabled boolean NOT NULL DEFAULT false,
  booking_confirm_template text,
  dropin_accepted_enabled boolean NOT NULL DEFAULT false,
  dropin_accepted_template text,
  project_update_enabled boolean NOT NULL DEFAULT false,
  project_update_template text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notification_settings TO authenticated;
GRANT ALL ON public.whatsapp_notification_settings TO service_role;
ALTER TABLE public.whatsapp_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY wns_all ON public.whatsapp_notification_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-sync leads with phone numbers into whatsapp_contacts (mirrors email sync)
CREATE OR REPLACE FUNCTION public.sync_lead_to_whatsapp_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_phone text;
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN RETURN NEW; END IF;
  clean_phone := regexp_replace(NEW.phone, '\D', '', 'g');
  IF clean_phone = '' THEN RETURN NEW; END IF;

  INSERT INTO public.whatsapp_contacts (user_id, phone, name, source, source_meta, lead_id, tags)
  VALUES (
    NEW.user_id, clean_phone, COALESCE(NEW.name, clean_phone),
    'lead',
    jsonb_build_object('lead_source', NEW.source, 'stage', NEW.stage),
    NEW.id,
    ARRAY['lead', 'source:' || NEW.source, 'stage:' || NEW.stage]
  )
  ON CONFLICT (user_id, phone) DO UPDATE
    SET name = COALESCE(public.whatsapp_contacts.name, EXCLUDED.name),
        lead_id = COALESCE(public.whatsapp_contacts.lead_id, EXCLUDED.lead_id),
        tags = (SELECT ARRAY(SELECT DISTINCT unnest(public.whatsapp_contacts.tags || EXCLUDED.tags))),
        updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_lead_to_whatsapp ON public.leads;
CREATE TRIGGER trg_sync_lead_to_whatsapp
  AFTER INSERT OR UPDATE OF phone, name ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_to_whatsapp_contact();

-- updated_at triggers
CREATE TRIGGER trg_wsc_upd BEFORE UPDATE ON public.whatsapp_sender_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wt_upd BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wc_upd BEFORE UPDATE ON public.whatsapp_contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wl_upd BEFORE UPDATE ON public.whatsapp_lists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wcmp_upd BEFORE UPDATE ON public.whatsapp_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wa_upd BEFORE UPDATE ON public.whatsapp_automations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_war_upd BEFORE UPDATE ON public.whatsapp_automation_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wconv_upd BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wsn_upd BEFORE UPDATE ON public.whatsapp_snippets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add page permission entries for the new module
INSERT INTO public.role_page_permissions (role, page, allowed) VALUES
  ('admin','whatsapp', true),
  ('user','whatsapp', false)
ON CONFLICT DO NOTHING;
