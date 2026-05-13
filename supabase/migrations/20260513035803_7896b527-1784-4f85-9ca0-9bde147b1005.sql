-- Make partners shared (like company_profile/projects): any authenticated user can manage
DROP POLICY IF EXISTS partners_insert_own ON public.partners;
DROP POLICY IF EXISTS partners_update_own ON public.partners;
DROP POLICY IF EXISTS partners_delete_own ON public.partners;

CREATE POLICY partners_insert_auth ON public.partners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY partners_update_auth ON public.partners FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY partners_delete_auth ON public.partners FOR DELETE TO authenticated USING (true);