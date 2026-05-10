INSERT INTO public.role_page_permissions (role, page, allowed) VALUES
  ('admin', 'idcards', true),
  ('user', 'idcards', true)
ON CONFLICT (role, page) DO NOTHING;