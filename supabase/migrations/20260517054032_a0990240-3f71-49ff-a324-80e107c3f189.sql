ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS progress_pct INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_completion DATE;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_phase_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_phase_check
  CHECK (phase IS NULL OR phase IN ('Inquiry','Design','Approval','Execution','Finishing','Handover'));

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_progress_pct_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_progress_pct_check
  CHECK (progress_pct >= 0 AND progress_pct <= 100);

UPDATE public.projects SET phase = 'Handover', progress_pct = 100 WHERE status = 'completed' AND phase IS NULL;
UPDATE public.projects SET phase = 'Execution', progress_pct = 50 WHERE status = 'ongoing' AND phase IS NULL;
UPDATE public.projects SET phase = 'Inquiry', progress_pct = 5 WHERE phase IS NULL;