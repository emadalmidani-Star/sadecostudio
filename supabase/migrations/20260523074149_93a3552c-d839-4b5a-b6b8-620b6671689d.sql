
-- Leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  message text,
  source text NOT NULL DEFAULT 'manual',
  source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage text NOT NULL DEFAULT 'new',
  assigned_to uuid,
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_lead()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source NOT IN ('manual','web_form','email','whatsapp','other') THEN
    RAISE EXCEPTION 'Invalid source: %', NEW.source;
  END IF;
  IF NEW.stage NOT IN ('new','contacted','qualified','proposal','won','lost') THEN
    RAISE EXCEPTION 'Invalid stage: %', NEW.stage;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_lead BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead();

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_select_own ON public.leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY leads_insert_own ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY leads_update_own ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY leads_delete_own ON public.leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX leads_user_stage_idx ON public.leads(user_id, stage);
CREATE INDEX leads_user_created_idx ON public.leads(user_id, created_at DESC);

-- Intake tokens
CREATE TABLE public.lead_intake_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  token text NOT NULL UNIQUE,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_intake_token()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind NOT IN ('web_form','email','whatsapp') THEN
    RAISE EXCEPTION 'Invalid kind: %', NEW.kind;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_intake_token BEFORE INSERT OR UPDATE ON public.lead_intake_tokens
  FOR EACH ROW EXECUTE FUNCTION public.validate_intake_token();

ALTER TABLE public.lead_intake_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY lit_select_own ON public.lead_intake_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY lit_insert_own ON public.lead_intake_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY lit_update_own ON public.lead_intake_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY lit_delete_own ON public.lead_intake_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Permissions defaults
INSERT INTO public.role_page_permissions(role, page, allowed) VALUES
  ('admin','leads', true),
  ('marketing','leads', true),
  ('user','leads', false)
ON CONFLICT DO NOTHING;
