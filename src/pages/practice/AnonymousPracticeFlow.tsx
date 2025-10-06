import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Link as LinkIcon, LogOut, Sparkles, User } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/FileUpload';
import { ConfigCard } from '@/components/ConfigCard';
import { GenerationProgress } from '@/components/GenerationProgress';
import { MCQQuestion } from '@/components/MCQQuestion';
import { ResultsSummary } from '@/components/ResultsSummary';
import { ThemeToggle } from '@/components/ThemeToggle';
import GuestUpgradeCallout from '@/components/GuestUpgradeCallout';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import {
  completeQuizSession,
  createDocument,
  createQuizSession,
  createStudySet,
  fetchStudySet,
  generateMCQs,
  parseContent,
  recordAttempt,
  type MCQItem,
} from '@/lib/api';

const PRACTICE_STAGE_KEY = 'qm-practice-stage';
const PRACTICE_ACTIVE_KEY = 'qm-practice-active';

const INITIAL_STEPS = () => ([
  { label: 'Parsing content', status: 'pending' as const },
  { label: 'Chunking text', status: 'pending' as const },
  { label: 'Generating MCQs with AI', status: 'pending' as const },
  { label: 'Validating questions', status: 'pending' as const },
  { label: 'Finalising', status: 'pending' as const },
]);

type Stage = 'upload' | 'config' | 'generating' | 'quiz' | 'results';

type GenerationStep = ReturnType<typeof INITIAL_STEPS>[number];

type AttemptSummary = {
  stem: string;
  chosen: string;
  correct: string;
  isCorrect: boolean;
};

const normalizeSourceUrl = (rawUrl?: string) => {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    throw new Error('Please enter a valid URL (e.g. https://example.com).');
  }
};

const useGuestQuota = (isGuest: boolean, metadata: Record<string, unknown> | null | undefined) =>
  useMemo(() => {
    if (!isGuest || !metadata) {
      return { documents: 2, studySets: 2 };
    }
    const guestMeta = metadata as { guest?: { quota?: { documents?: number; studySets?: number } } };
    return {
      documents: guestMeta.guest?.quota?.documents ?? 2,
      studySets: guestMeta.guest?.quota?.studySets ?? 2,
    };
  }, [isGuest, metadata]);

const AnonymousPracticeFlow = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, signOut, isGuest } = useAuth();

  const [stage, setStage] = useState<Stage>('upload');
  const [steps, setSteps] = useState<GenerationStep[]>(INITIAL_STEPS);
  const [sourceText, setSourceText] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [studySetId, setStudySetId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<MCQItem[]>([]);
  const [allQuestions, setAllQuestions] = useState<MCQItem[]>([]);
  const [attempts, setAttempts] = useState<Array<{ itemId: string; response: string; isCorrect: boolean; timeMs: number }>>([]);

  const guestQuota = useGuestQuota(isGuest, profile?.metadata ?? null);

  const resetSteps = useCallback(() => setSteps(INITIAL_STEPS()), []);

  const loadStudySetById = useCallback(async (setId: string) => {
    try {
      toast.info('Loading study set...');
      const { studySet, items } = await fetchStudySet(setId);
      if (!items.length) {
        toast.error('Study set has no questions.');
        return;
      }

      setStudySetId(setId);
      setSourceType(studySet.sourceType);
      setSourceUrl(studySet.sourceUrl ?? '');
      setSourceText(studySet.text);
      setPreviewText(studySet.text);
      setTopics(studySet.topics ?? []);
      setDocumentId(studySet.sourceDocumentId ?? '');
      setQuestions(items);
      setAllQuestions(items);
      setAttempts([]);
      setCurrentQuestionIndex(0);

      const newSessionId = await createQuizSession(
        setId,
        items.map((item) => item.id),
      );
      setSessionId(newSessionId);
      setSessionStartTime(Date.now());
      setStage('quiz');
      toast.success(`Loaded ${items.length} questions`);
    } catch (error) {
      console.error('Failed to load study set:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load study set. Please try again.');
    } finally {
      navigate('.', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const state = location.state as { studySetId?: string } | null;
    if (state?.studySetId) {
      loadStudySetById(state.studySetId);
    }
  }, [location.state, loadStudySetById]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PRACTICE_STAGE_KEY, stage);
    window.localStorage.setItem(PRACTICE_ACTIVE_KEY, stage === 'upload' ? '0' : '1');
  }, [stage]);

  const handleParse = useCallback(async (data: { sourceType: string; text: string; sourceUrl?: string }) => {
    try {
      toast.info('Processing your content...');
      const normalizedUrl = normalizeSourceUrl(data.sourceUrl);
      const parseResult = await parseContent(data.sourceType, data.text, normalizedUrl);

      setSourceType(data.sourceType);
      setSourceText(parseResult.text);
      setPreviewText(parseResult.text);
      setSourceUrl(normalizedUrl || '');

      const extractedTopics = parseResult.topics
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean);
      setTopics(extractedTopics);

      const title = normalizedUrl
        ? `Document from ${new URL(normalizedUrl).hostname}`
        : `${data.sourceType.toUpperCase()} - ${new Date().toLocaleDateString()}`;

      const docId = await createDocument({
        title,
        sourceType: data.sourceType,
        sourceUrl: normalizedUrl,
        content: parseResult.text,
      });

      setDocumentId(docId);
      setStage('config');
      toast.success('Content parsed and saved successfully');
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse content. Please try again.');
    }
  }, []);

  const updateStep = useCallback((index: number, status: GenerationStep['status']) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, status } : step)));
  }, []);

  const handleGenerate = useCallback(async (config: { mcqCount: number; difficulty: string; topics: string[] }) => {
    try {
      setStage('generating');
      updateStep(0, 'active');

      const setId = await createStudySet({
        title: `Study Set - ${new Date().toLocaleDateString()}`,
        text: sourceText,
        topics: config.topics,
        config,
        sourceType,
        sourceUrl: sourceType === 'url' ? sourceUrl : undefined,
        documentId: documentId || undefined,
      });

      setStudySetId(setId);
      updateStep(0, 'completed');

      updateStep(1, 'active');
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateStep(1, 'completed');

      updateStep(2, 'active');
      await generateMCQs(setId);
      updateStep(2, 'completed');

      updateStep(3, 'active');
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateStep(3, 'completed');

      updateStep(4, 'active');
      const { items } = await fetchStudySet(setId);
      if (!items.length) {
        throw new Error('No questions were generated. Please try with different content or settings.');
      }

      setQuestions(items);
      setAllQuestions(items);
      setAttempts([]);
      setCurrentQuestionIndex(0);
      updateStep(4, 'completed');

      const newSessionId = await createQuizSession(setId, items.map((item) => item.id));
      setSessionId(newSessionId);
      setSessionStartTime(Date.now());

      toast.success(`Generated ${items.length} questions!`);
      setTimeout(() => setStage('quiz'), 1000);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate MCQs. Please try again.');
      const activeIndex = steps.findIndex((step) => step.status === 'active');
      if (activeIndex >= 0) {
        updateStep(activeIndex, 'error');
      }
    }
  }, [documentId, sourceText, sourceType, sourceUrl, steps, updateStep]);

  const handleAnswer = useCallback(async (response: string, isCorrect: boolean, timeMs: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    setAttempts((prev) => [...prev, { itemId: currentQuestion.id, response, isCorrect, timeMs }]);
    try {
      await recordAttempt(sessionId, currentQuestion.id, response, isCorrect, timeMs);
    } catch (error) {
      console.error('Failed to record attempt:', error);
    }
  }, [currentQuestionIndex, questions, sessionId]);

  const finishQuiz = useCallback(async () => {
    const totalMs = Date.now() - sessionStartTime;
    const correctCount = attempts.filter((attempt) => attempt.isCorrect).length;
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    try {
      await completeQuizSession(sessionId, score, totalMs);
    } catch (error) {
      console.error('Failed to complete session:', error);
    }
    setStage('results');
  }, [attempts, questions.length, sessionId, sessionStartTime]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((index) => index + 1);
    } else {
      finishQuiz();
    }
  }, [currentQuestionIndex, finishQuiz, questions.length]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((index) => index - 1);
    }
  }, [currentQuestionIndex]);

  const attemptSummaries = useMemo<AttemptSummary[]>(() => {
    if (!attempts.length) return [];
    const map = new Map(questions.map((question) => [question.id, question]));
    return attempts.map((attempt) => {
      const question = map.get(attempt.itemId);
      return {
        stem: question?.stem ?? '',
        chosen: attempt.response,
        correct: question?.answer_key ?? '',
        isCorrect: attempt.isCorrect,
      };
    });
  }, [attempts, questions]);

  const handleRetryIncorrect = useCallback(async () => {
    const incorrect = attempts
      .filter((attempt) => !attempt.isCorrect)
      .map((attempt) => questions.find((question) => question.id === attempt.itemId))
      .filter(Boolean) as MCQItem[];

    if (!incorrect.length) {
      toast.info('No incorrect answers to retry!');
      return;
    }

    try {
      if (studySetId) {
        const newSessionId = await createQuizSession(studySetId, incorrect.map((item) => item.id));
        setSessionId(newSessionId);
      }

      setQuestions(incorrect);
      setCurrentQuestionIndex(0);
      setAttempts([]);
      setSessionStartTime(Date.now());
      setStage('quiz');
      toast.info(`Retrying ${incorrect.length} questions`);
    } catch (error) {
      console.error('Failed to start retry session:', error);
      toast.error('Could not start retry session. Please try again.');
    }
  }, [attempts, questions, studySetId]);

  const handleViewStudySet = useCallback(async () => {
    if (!studySetId) {
      toast.error('No study set available to review.');
      return;
    }
    const baseQuestions = allQuestions.length > 0 ? allQuestions : questions;
    if (!baseQuestions.length) {
      toast.error('Study set has no questions to review.');
      return;
    }
    try {
      const newSessionId = await createQuizSession(studySetId, baseQuestions.map((item) => item.id));
      setSessionId(newSessionId);
      setQuestions([...baseQuestions]);
      setAttempts([]);
      setCurrentQuestionIndex(0);
      setSessionStartTime(Date.now());
      setStage('quiz');
      toast.info('Study set ready for another run');
    } catch (error) {
      console.error('Failed to reload study set:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reload study set. Please try again.');
    }
  }, [allQuestions, questions, studySetId]);

  const handleNewTest = useCallback(() => {
    setQuestions([]);
    setAllQuestions([]);
    setAttempts([]);
    setCurrentQuestionIndex(0);
    setStudySetId('');
    setSessionId('');
    setSessionStartTime(0);
    resetSteps();
    setStage('config');
    toast.info('Configure a new test set');
  }, [resetSteps]);

  const renderUploadStage = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-3">Upload Your Study Material</h2>
        <p className="text-muted-foreground">Upload a PDF, paste text, or provide a URL to get started</p>
      </div>
      <FileUpload onParse={handleParse} />
    </div>
  );

  const renderConfigStage = () => (
    <div className="max-w-6xl mx-auto">
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="preview">File Preview</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4">
          <Card className="p-6 shadow-medium">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
              {sourceType === 'pdf' && <FileText className="h-8 w-8 text-primary" />}
              {sourceType === 'text' && <FileText className="h-8 w-8 text-primary" />}
              {sourceType === 'url' && <LinkIcon className="h-8 w-8 text-primary" />}
              <div>
                <h3 className="font-semibold">
                  {sourceType === 'pdf' && 'PDF Document'}
                  {sourceType === 'text' && 'Text Input'}
                  {sourceType === 'url' && 'Web Content'}
                </h3>
                {sourceUrl && (
                  <p className="text-sm text-muted-foreground truncate max-w-lg">{sourceUrl}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Parsed Text</h4>
                <div className="bg-muted rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
                    {previewText || 'No preview available'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {sourceText.length.toLocaleString()} characters • ~{Math.round(sourceText.length / 4)} tokens
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <ConfigCard topics={topics} onTopicsChange={setTopics} onGenerate={handleGenerate} />
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderGeneratingStage = () => (
    <div className="max-w-2xl mx-auto">
      <GenerationProgress steps={steps} />
    </div>
  );

  const renderQuizStage = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) {
      return null;
    }
    return (
      <MCQQuestion
        stem={currentQuestion.stem}
        options={currentQuestion.options}
        answerKey={currentQuestion.answer_key}
        solution={currentQuestion.solution}
        sources={currentQuestion.sources}
        currentIndex={currentQuestionIndex}
        total={questions.length}
        onAnswer={handleAnswer}
        onNext={handleNextQuestion}
        onPrevious={handlePreviousQuestion}
        hasNext={currentQuestionIndex < questions.length - 1}
        hasPrevious={currentQuestionIndex > 0}
      />
    );
  };

  const renderResultsStage = () => {
    const correctCount = attempts.filter((attempt) => attempt.isCorrect).length;
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const totalMs = Date.now() - sessionStartTime;

    return (
      <ResultsSummary
        score={score}
        totalMs={totalMs}
        attempts={attemptSummaries}
        onRetryIncorrect={handleRetryIncorrect}
        onViewStudySet={handleViewStudySet}
        onNewTest={handleNewTest}
        isGuest={isGuest}
      />
    );
  };

  const renderStage = () => {
    switch (stage) {
      case 'upload':
        return renderUploadStage();
      case 'config':
        return renderConfigStage();
      case 'generating':
        return renderGeneratingStage();
      case 'quiz':
        return renderQuizStage();
      case 'results':
        return renderResultsStage();
      default:
        return null;
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Preparing your study session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Study Helper</h1>
                <p className="text-xs text-muted-foreground">AI-powered MCQ generation</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary hover:text-primary"
              >
                Profile
              </Link>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {profile?.username || user.email?.split('@')[0]}
                </span>
                {isGuest && <Badge variant="outline" className="uppercase tracking-wide">Guest Access</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-8">
        {isGuest && (stage === 'upload' || stage === 'config') && (
          <GuestUpgradeCallout
            description={`Guest accounts can upload up to ${guestQuota.documents} documents and generate ${guestQuota.studySets} quiz sets. Sign up to unlock study and exam modes, progress tracking, and unlimited sets.`}
          />
        )}

        {renderStage()}
      </main>

      <footer className="border-t border-border bg-card/50 backdrop-blur-sm mt-24">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>Powered by AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AnonymousPracticeFlow;
