
-- Add manager to enum (idempotent)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.role_page_permissions (
  role public.app_role NOT NULL,
  page text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, page)
);

ALTER TABLE public.role_page_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rpp_select ON public.role_page_permissions;
CREATE POLICY rpp_select ON public.role_page_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rpp_admin_all ON public.role_page_permissions;
CREATE POLICY rpp_admin_all ON public.role_page_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
