CREATE TABLE IF NOT EXISTS public.test_arena_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  intensity TEXT NOT NULL CHECK (intensity IN ('light', 'standard', 'intense')),
  timer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  question_plan JSONB NOT NULL,
  folder_ids UUID[] NOT NULL DEFAULT '{}',
  document_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'archived')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.test_arena_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.test_arena_tests(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'configured' CHECK (status IN ('configured', 'in_progress', 'completed', 'cancelled')),
  generated_exam JSONB,
  responses JSONB,
  evaluation JSONB,
  summary JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_arena_tests_owner ON public.test_arena_tests(owner_id);
CREATE INDEX IF NOT EXISTS idx_test_arena_runs_test ON public.test_arena_runs(test_id);
CREATE INDEX IF NOT EXISTS idx_test_arena_runs_owner ON public.test_arena_runs(owner_id);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_arena_tests_updated ON public.test_arena_tests;
CREATE TRIGGER trg_test_arena_tests_updated
BEFORE UPDATE ON public.test_arena_tests
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at();

DROP TRIGGER IF EXISTS trg_test_arena_runs_updated ON public.test_arena_runs;
CREATE TRIGGER trg_test_arena_runs_updated
BEFORE UPDATE ON public.test_arena_runs
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at();

ALTER TABLE public.test_arena_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_arena_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tests" ON public.test_arena_tests;
CREATE POLICY "Users manage own tests"
ON public.test_arena_tests
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users manage own test runs" ON public.test_arena_runs;
CREATE POLICY "Users manage own test runs"
ON public.test_arena_runs
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);
