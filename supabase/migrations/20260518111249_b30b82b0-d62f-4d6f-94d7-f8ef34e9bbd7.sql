INSERT INTO public.role_page_permissions (role, page, allowed) VALUES
  ('admin','gallery', true),
  ('user','gallery', false),
  ('marketing','gallery', true)
ON CONFLICT (role, page) DO NOTHING;