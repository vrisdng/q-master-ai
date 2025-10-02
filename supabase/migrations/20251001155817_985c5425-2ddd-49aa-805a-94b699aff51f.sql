-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Study sets table
CREATE TABLE public.study_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'text', 'url')),
  source_url TEXT,
  text TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Chunks table for RAG (with embeddings)
CREATE TABLE public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items table (MCQs)
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mcq',
  stem TEXT NOT NULL,
  options JSONB NOT NULL,
  answer_key TEXT NOT NULL CHECK (answer_key IN ('A', 'B', 'C', 'D')),
  solution TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quiz sessions table
CREATE TABLE public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  question_ids TEXT[] NOT NULL DEFAULT '{}',
  score INTEGER,
  time_total_ms INTEGER
);

-- Attempts table
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL,
  time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_chunks_study_set ON public.chunks(study_set_id);
CREATE INDEX idx_chunks_embedding ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_items_study_set ON public.items(study_set_id);
CREATE INDEX idx_sessions_study_set ON public.quiz_sessions(study_set_id);
CREATE INDEX idx_attempts_session ON public.attempts(session_id);
CREATE INDEX idx_attempts_item ON public.attempts(item_id);

-- Enable RLS (but allow all access for now since no auth)
ALTER TABLE public.study_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (no auth required)
CREATE POLICY "Allow all access to study_sets" ON public.study_sets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to chunks" ON public.chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to items" ON public.items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to quiz_sessions" ON public.quiz_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to attempts" ON public.attempts FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- PROFILES & DOCUMENTS (USER-OWNED RESOURCES) PLUS OWNERSHIP METADATA LINKS
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'text', 'url')),
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  page_count INTEGER,
  content_sha TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.study_sets
  ADD COLUMN owner_id UUID DEFAULT auth.uid() REFERENCES public.profiles(id),
  ADD COLUMN source_document_id UUID REFERENCES public.documents(id);

CREATE INDEX idx_documents_owner ON public.documents(owner_id);
CREATE INDEX idx_study_sets_owner ON public.study_sets(owner_id);
CREATE INDEX idx_study_sets_source_document ON public.study_sets(source_document_id);

-- KEEP UPDATED_AT CURRENT AUTOMATICALLY
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUTO-PROVISION A PROFILE WHEN A NEW AUTH USER IS CREATED
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, metadata)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE
    SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- REPLACE PERMISSIVE POLICIES WITH OWNER-SCOPED RULES
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow all access to study_sets" ON public.study_sets;
DROP POLICY IF EXISTS "Allow all access to chunks" ON public.chunks;
DROP POLICY IF EXISTS "Allow all access to items" ON public.items;
DROP POLICY IF EXISTS "Allow all access to quiz_sessions" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Allow all access to attempts" ON public.attempts;

CREATE POLICY "Users can select own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can upsert own profile"
  ON public.profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own documents"
  ON public.documents
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users select own study sets"
  ON public.study_sets
  FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users manage own study sets"
  ON public.study_sets
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users select chunks on owned sets"
  ON public.chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = chunks.study_set_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users manage chunks on owned sets"
  ON public.chunks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = chunks.study_set_id
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = chunks.study_set_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users select items on owned sets"
  ON public.items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = items.study_set_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users manage items on owned sets"
  ON public.items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = items.study_set_id
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = items.study_set_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users select own quiz sessions"
  ON public.quiz_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = quiz_sessions.study_set_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own quiz sessions"
  ON public.quiz_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = quiz_sessions.study_set_id
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.study_sets s
      WHERE s.id = quiz_sessions.study_set_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users select own attempts"
  ON public.attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_sessions qs
      JOIN public.study_sets s ON s.id = qs.study_set_id
      WHERE qs.id = attempts.session_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own attempts"
  ON public.attempts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_sessions qs
      JOIN public.study_sets s ON s.id = qs.study_set_id
      WHERE qs.id = attempts.session_id
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quiz_sessions qs
      JOIN public.study_sets s ON s.id = qs.study_set_id
      WHERE qs.id = attempts.session_id
        AND s.owner_id = auth.uid()
    )
  );
