-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Study sets table
CREATE TABLE public.study_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quiz sessions table
CREATE TABLE public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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