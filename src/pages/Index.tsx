import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, FileText, Link as LinkIcon, LogOut, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/FileUpload';
import { ConfigCard } from '@/components/ConfigCard';
import { GenerationProgress } from '@/components/GenerationProgress';
import { MCQQuestion } from '@/components/MCQQuestion';
import { ResultsSummary } from '@/components/ResultsSummary';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { 
  parseContent, 
  createStudySet, 
  generateMCQs, 
  fetchStudySet,
  createQuizSession,
  recordAttempt,
  completeQuizSession,
  type MCQItem 
} from '@/lib/api';

type Stage = 'upload' | 'config' | 'generating' | 'quiz' | 'results';

type GenerationStep = {
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
};

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const [stage, setStage] = useState<Stage>('upload');
  const [sourceText, setSourceText] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [previewText, setPreviewText] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studySetId, setStudySetId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [questions, setQuestions] = useState<MCQItem[]>([]);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([
    { label: 'Parsing content', status: 'pending' },
    { label: 'Chunking text', status: 'pending' },
    { label: 'Generating MCQs with AI', status: 'pending' },
    { label: 'Validating questions', status: 'pending' },
    { label: 'Finalising', status: 'pending' },
  ]);
  const [sessionStartTime, setSessionStartTime] = useState(0);
  const [attempts, setAttempts] = useState<Array<{
    itemId: string;
    response: string;
    isCorrect: boolean;
    timeMs: number;
  }>>([]);

  // Auth protection
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleParse = async (data: { sourceType: string; text: string; sourceUrl?: string }) => {
    try {
      toast.info('Processing your content...');
      
      // Call parse-content edge function
      const parseResult = await parseContent(
        data.sourceType,
        data.text,
        data.sourceUrl
      );
      
      setSourceType(data.sourceType);
      setSourceText(parseResult.text);
      setPreviewText(parseResult.text);
      setSourceUrl(data.sourceUrl || '');
      
      // Extract topics from comma-separated string
      const extractedTopics = parseResult.topics
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      setTopics(extractedTopics);
      
      setStage('config');
      toast.success('Content parsed successfully');
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse content. Please try again.');
    }
  };

  const updateGenerationStep = (index: number, status: GenerationStep['status']) => {
    setGenerationSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, status } : step
    ));
  };

  const handleGenerate = async (config: { mcqCount: number; difficulty: string; topics: string[] }) => {
    try {
      setStage('generating');
      
      // Step 1: Create study set
      updateGenerationStep(0, 'active');
      const setId = await createStudySet(
        `Study Set - ${new Date().toLocaleDateString()}`,
        sourceText,
        config.topics,
        config
      );
      setStudySetId(setId);
      updateGenerationStep(0, 'completed');
      
      // Step 2-5: Generate MCQs (handled by backend)
      updateGenerationStep(1, 'active');
      await new Promise(resolve => setTimeout(resolve, 500)); // UI feedback
      updateGenerationStep(1, 'completed');
      
      updateGenerationStep(2, 'active');
      const result = await generateMCQs(setId);
      updateGenerationStep(2, 'completed');
      
      updateGenerationStep(3, 'active');
      await new Promise(resolve => setTimeout(resolve, 500));
      updateGenerationStep(3, 'completed');
      
      updateGenerationStep(4, 'active');
      
      // Fetch generated questions
      const { items } = await fetchStudySet(setId);
      
      if (items.length === 0) {
        throw new Error('No questions were generated. Please try with different content or settings.');
      }
      
      setQuestions(items);
      updateGenerationStep(4, 'completed');
      
      // Create quiz session
      const sessionId = await createQuizSession(
        setId,
        items.map(item => item.id)
      );
      setSessionId(sessionId);
      setSessionStartTime(Date.now());
      
      toast.success(`Generated ${items.length} questions!`);
      
      setTimeout(() => {
        setStage('quiz');
      }, 1000);
    } catch (error) {
      console.error('Generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate MCQs. Please try again.';
      toast.error(errorMessage);
      
      // Mark current step as error
      const activeStepIndex = generationSteps.findIndex(s => s.status === 'active');
      if (activeStepIndex >= 0) {
        updateGenerationStep(activeStepIndex, 'error');
      }
    }
  };

  const handleAnswer = async (response: string, isCorrect: boolean, timeMs: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    
    // Record attempt
    const attempt = {
      itemId: currentQuestion.id,
      response,
      isCorrect,
      timeMs,
    };
    setAttempts(prev => [...prev, attempt]);
    
    try {
      await recordAttempt(sessionId, currentQuestion.id, response, isCorrect, timeMs);
    } catch (error) {
      console.error('Failed to record attempt:', error);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const finishQuiz = async () => {
    const totalMs = Date.now() - sessionStartTime;
    const correctCount = attempts.filter(a => a.isCorrect).length;
    const score = Math.round((correctCount / questions.length) * 100);
    
    try {
      await completeQuizSession(sessionId, score, totalMs);
    } catch (error) {
      console.error('Failed to complete session:', error);
    }
    
    setStage('results');
  };

  const handleRetryIncorrect = () => {
    const incorrectQuestions = attempts
      .filter(a => !a.isCorrect)
      .map(a => questions.find(q => q.id === a.itemId))
      .filter(Boolean) as MCQItem[];
    
    if (incorrectQuestions.length === 0) {
      toast.info('No incorrect answers to retry!');
      return;
    }
    
    setQuestions(incorrectQuestions);
    setCurrentQuestionIndex(0);
    setAttempts([]);
    setSessionStartTime(Date.now());
    setStage('quiz');
    toast.info(`Retrying ${incorrectQuestions.length} questions`);
  };

  const handleNewTest = () => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAttempts([]);
    setGenerationSteps([
      { label: 'Parsing content', status: 'pending' },
      { label: 'Chunking text', status: 'pending' },
      { label: 'Generating MCQs with AI', status: 'pending' },
      { label: 'Validating questions', status: 'pending' },
      { label: 'Finalising', status: 'pending' },
    ]);
    setStage('config');
    toast.info('Configure a new test set');
  };

  const currentQuestion = questions[currentQuestionIndex];
  const correctCount = attempts.filter(a => a.isCorrect).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const totalMs = Date.now() - sessionStartTime;

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
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
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {profile?.username || user.email?.split('@')[0]}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {stage === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">Upload Your Study Material</h2>
              <p className="text-muted-foreground">
                Upload a PDF, paste text, or provide a URL to get started
              </p>
            </div>
            <FileUpload onParse={handleParse} />
          </div>
        )}

        {stage === 'config' && (
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
                        <p className="text-sm text-muted-foreground truncate max-w-lg">
                          {sourceUrl}
                        </p>
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
                <ConfigCard
                  topics={topics}
                  onTopicsChange={setTopics}
                  onGenerate={handleGenerate}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {stage === 'generating' && (
          <div className="max-w-2xl mx-auto">
            <GenerationProgress steps={generationSteps} />
          </div>
        )}

        {stage === 'quiz' && currentQuestion && (
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
        )}

        {stage === 'results' && (
          <ResultsSummary
            score={score}
            totalMs={totalMs}
            attempts={attempts.map(attempt => {
              const question = questions.find(q => q.id === attempt.itemId);
              return {
                stem: question?.stem || '',
                chosen: attempt.response,
                correct: question?.answer_key || '',
                isCorrect: attempt.isCorrect,
              };
            })}
            onRetryIncorrect={handleRetryIncorrect}
            onNewTest={handleNewTest}
          />
        )}
      </main>

      {/* Footer */}
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

export default Index;
