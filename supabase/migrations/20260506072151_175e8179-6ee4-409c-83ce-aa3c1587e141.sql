
CREATE TABLE public.pdf_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  page_type text NOT NULL,
  background_url text,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, page_type)
);

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl_select" ON public.pdf_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tpl_insert" ON public.pdf_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tpl_update" ON public.pdf_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tpl_delete" ON public.pdf_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER pdf_templates_updated_at
BEFORE UPDATE ON public.pdf_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
