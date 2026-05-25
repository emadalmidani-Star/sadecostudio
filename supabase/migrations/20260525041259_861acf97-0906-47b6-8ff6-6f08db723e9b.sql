
-- Fix: touch_updated_at function missing search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$;

-- Fix: company_profile writes restricted to admins (keep public read for marketing site)
DROP POLICY IF EXISTS "Company profile editable by authenticated" ON public.company_profile;
CREATE POLICY "Company profile insert admin"
  ON public.company_profile FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company profile update admin"
  ON public.company_profile FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company profile delete admin"
  ON public.company_profile FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix: partners writes restricted to admins (keep public read for marketing site)
DROP POLICY IF EXISTS "partners_insert_auth" ON public.partners;
DROP POLICY IF EXISTS "partners_update_auth" ON public.partners;
DROP POLICY IF EXISTS "partners_delete_auth" ON public.partners;
CREATE POLICY "partners_insert_admin"
  ON public.partners FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "partners_update_admin"
  ON public.partners FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "partners_delete_admin"
  ON public.partners FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix: projects writes restricted to admin or creator (keep public read for marketing site)
DROP POLICY IF EXISTS "Projects insert by authenticated" ON public.projects;
DROP POLICY IF EXISTS "Projects update by authenticated" ON public.projects;
DROP POLICY IF EXISTS "Projects delete by authenticated" ON public.projects;
CREATE POLICY "Projects insert admin or creator"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = created_by);
CREATE POLICY "Projects update admin or creator"
  ON public.projects FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = created_by)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = created_by);
CREATE POLICY "Projects delete admin or creator"
  ON public.projects FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = created_by);

-- Fix: fitout_sheet_config integration internals restricted to admin
DROP POLICY IF EXISTS "fsc_select_auth" ON public.fitout_sheet_config;
CREATE POLICY "fsc_select_admin"
  ON public.fitout_sheet_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix: fitout_sheet_sync_runs restricted to admin
DROP POLICY IF EXISTS "fssr_select_auth" ON public.fitout_sheet_sync_runs;
CREATE POLICY "fssr_select_admin"
  ON public.fitout_sheet_sync_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
