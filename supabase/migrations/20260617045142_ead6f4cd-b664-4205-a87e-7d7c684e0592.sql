
-- profiles SELECT
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- user_roles SELECT
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- company_profile SELECT - restrict to authenticated
DROP POLICY IF EXISTS "Company profile readable by all" ON public.company_profile;
CREATE POLICY "Company profile readable by authenticated" ON public.company_profile
  FOR SELECT TO authenticated
  USING (true);

-- storage company-assets INSERT - admin only
DROP POLICY IF EXISTS "Auth write company-assets" ON storage.objects;
CREATE POLICY "Admins write company-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'));

-- storage project-images INSERT - admin only
DROP POLICY IF EXISTS "Auth write project-images" ON storage.objects;
CREATE POLICY "Admins write project-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-images' AND public.has_role(auth.uid(), 'admin'));
