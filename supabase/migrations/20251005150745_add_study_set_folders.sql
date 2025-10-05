ALTER TABLE public.study_sets
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label_text TEXT,
  ADD COLUMN IF NOT EXISTS label_color TEXT;

CREATE INDEX IF NOT EXISTS idx_study_sets_folder ON public.study_sets(folder_id);
