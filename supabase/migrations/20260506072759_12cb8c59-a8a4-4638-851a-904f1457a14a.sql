
-- Template sets
CREATE TABLE public.template_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.template_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_select" ON public.template_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ts_insert" ON public.template_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ts_update" ON public.template_sets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ts_delete" ON public.template_sets FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER template_sets_updated BEFORE UPDATE ON public.template_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate pdf_templates: add set_id and adjust uniqueness
ALTER TABLE public.pdf_templates ADD COLUMN set_id uuid;

-- Backfill: create a "Default" set per user that already has templates
DO $$
DECLARE r record; sid uuid;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.pdf_templates WHERE set_id IS NULL LOOP
    INSERT INTO public.template_sets(user_id, name) VALUES (r.user_id, 'Default') RETURNING id INTO sid;
    UPDATE public.pdf_templates SET set_id = sid WHERE user_id = r.user_id AND set_id IS NULL;
  END LOOP;
END$$;

ALTER TABLE public.pdf_templates DROP CONSTRAINT IF EXISTS pdf_templates_user_id_page_type_key;
ALTER TABLE public.pdf_templates ADD CONSTRAINT pdf_templates_set_page_unique UNIQUE (set_id, page_type);

-- Template pages (uploaded raster pages awaiting role assignment)
CREATE TABLE public.template_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  set_id uuid NOT NULL REFERENCES public.template_sets(id) ON DELETE CASCADE,
  page_index int NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.template_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_select" ON public.template_pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tp_insert" ON public.template_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tp_update" ON public.template_pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tp_delete" ON public.template_pages FOR DELETE USING (auth.uid() = user_id);

-- Export assignments
CREATE TABLE public.export_template_assignments (
  user_id uuid NOT NULL,
  export_kind text NOT NULL,
  set_id uuid REFERENCES public.template_sets(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, export_kind)
);
ALTER TABLE public.export_template_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eta_select" ON public.export_template_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "eta_insert" ON public.export_template_assignments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "eta_update" ON public.export_template_assignments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "eta_delete" ON public.export_template_assignments FOR DELETE USING (auth.uid() = user_id);
