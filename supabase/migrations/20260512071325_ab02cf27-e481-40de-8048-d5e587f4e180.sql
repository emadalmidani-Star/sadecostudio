-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  logo_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_select_all" ON public.partners FOR SELECT USING (true);
CREATE POLICY "partners_insert_own" ON public.partners FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "partners_update_own" ON public.partners FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "partners_delete_own" ON public.partners FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER partners_updated_at BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Layout settings on company_profile
ALTER TABLE public.company_profile
  ADD COLUMN partners_intro text,
  ADD COLUMN partners_layout jsonb NOT NULL DEFAULT '{"cols":3,"tile_style":"outlined","font_size":13,"logo_mode":true}'::jsonb;