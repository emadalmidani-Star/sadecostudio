REVOKE SELECT ON public.projects FROM anon;
GRANT SELECT (id, created_by, name, location, type, area_sqm, status, description, highlights, images, cover_image, created_at, updated_at, phase, progress_pct, estimated_completion) ON public.projects TO anon;
GRANT SELECT ON public.projects TO authenticated;