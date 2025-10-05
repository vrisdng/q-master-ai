-- Create folders table for organizing documents
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name ~ '^[A-Za-z0-9 _-]+$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Index for owner lookups
CREATE INDEX idx_folders_owner ON public.folders(owner_id);

-- Keep updated_at in sync
CREATE TRIGGER set_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Policies for folders (mirror documents)
CREATE POLICY "Users can view own folders"
  ON public.folders
  FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users manage own folders"
  ON public.folders
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Link documents to folders
ALTER TABLE public.documents
  ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_folder ON public.documents(folder_id);
