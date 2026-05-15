
CREATE TABLE public.fitout_sheet_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_url text,
  sheet_id text,
  worksheet_name text,
  header_row integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fitout_sheet_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsc_select_auth" ON public.fitout_sheet_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "fsc_admin_all" ON public.fitout_sheet_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER fsc_touch BEFORE UPDATE ON public.fitout_sheet_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fitout_sheet_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running'
);

ALTER TABLE public.fitout_sheet_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fssr_select_auth" ON public.fitout_sheet_sync_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fssr_admin_all" ON public.fitout_sheet_sync_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.fitout_sheet_config (header_row, enabled) VALUES (1, false);
