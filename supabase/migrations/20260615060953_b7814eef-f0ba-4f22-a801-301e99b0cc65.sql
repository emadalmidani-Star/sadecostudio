
DROP POLICY IF EXISTS "Auth update company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth update project-images" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete project-images" ON storage.objects;

CREATE POLICY "Owner or admin update company-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (bucket_id = 'company-assets' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Owner or admin delete company-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Owner or admin update project-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-images' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (bucket_id = 'project-images' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Owner or admin delete project-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-images' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
