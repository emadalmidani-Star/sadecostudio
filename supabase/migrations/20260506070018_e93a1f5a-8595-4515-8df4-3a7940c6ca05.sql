CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.category_covers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

ALTER TABLE public.category_covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_select" ON public.category_covers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cc_insert" ON public.category_covers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_update" ON public.category_covers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cc_delete" ON public.category_covers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_category_covers_updated_at
BEFORE UPDATE ON public.category_covers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();