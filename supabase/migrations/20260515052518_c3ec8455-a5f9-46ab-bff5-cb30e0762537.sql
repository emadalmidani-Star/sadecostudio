
CREATE TABLE public.fitout_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_added DATE,
  hod TEXT,
  pm TEXT,
  city_province TEXT,
  brand TEXT,
  location TEXT,
  project_type TEXT,
  size_m2 NUMERIC,
  fitout_period_days INTEGER,
  start_on_site DATE,
  fitout_completion DATE,
  store_handover DATE,
  snag_prep_date DATE,
  contract_period_days INTEGER,
  store_opening DATE,
  snag_completion_date DATE,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'Planning',
  supervisor TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fitout_status ON public.fitout_projects(status);
CREATE INDEX idx_fitout_start_on_site ON public.fitout_projects(start_on_site);
CREATE INDEX idx_fitout_store_opening ON public.fitout_projects(store_opening);

ALTER TABLE public.fitout_projects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_fitout_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('Planning','In Progress','Snag','Completed','On Hold','Cancelled') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fitout_validate_status
BEFORE INSERT OR UPDATE ON public.fitout_projects
FOR EACH ROW EXECUTE FUNCTION public.validate_fitout_status();

CREATE TRIGGER trg_fitout_touch_updated
BEFORE UPDATE ON public.fitout_projects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "fitout_select_auth" ON public.fitout_projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fitout_insert_auth" ON public.fitout_projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "fitout_update_owner_or_admin" ON public.fitout_projects
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "fitout_delete_owner_or_admin" ON public.fitout_projects
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

INSERT INTO public.role_page_permissions(role, page, allowed) VALUES
  ('admin','fitout', true),
  ('user','fitout', true)
ON CONFLICT DO NOTHING;
