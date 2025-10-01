import { useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { ConfigCard } from '@/components/ConfigCard';
import { GenerationProgress } from '@/components/GenerationProgress';
import { MCQQuestion } from '@/components/MCQQuestion';
import { ResultsSummary } from '@/components/ResultsSummary';
import { toast } from 'sonner';

type Stage = 'upload' | 'config' | 'generating' | 'quiz' | 'results';

const Index = () => {
  const [stage, setStage] = useState<Stage>('upload');
  const [sourceText, setSourceText] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [previewText, setPreviewText] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Mock data for demonstration
  const mockQuestions = [
    {
      stem: 'What is the primary purpose of photosynthesis in plants?',
      options: [
        { label: 'A', text: 'To produce oxygen for animals' },
        { label: 'B', text: 'To convert light energy into chemical energy' },
        { label: 'C', text: 'To absorb carbon dioxide from the atmosphere' },
        { label: 'D', text: 'To generate heat for the plant' },
      ],
      answerKey: 'B',
      solution: 'Photosynthesis is the process by which plants convert light energy (usually from the sun) into chemical energy stored in glucose molecules. Whilst oxygen production and CO₂ absorption are important byproducts, the primary purpose is energy conversion.',
      sources: [
        { chunkId: '1', excerpt: 'Photosynthesis occurs in the chloroplasts of plant cells, where light energy is captured by chlorophyll and converted into glucose.' },
        { chunkId: '2', excerpt: 'The process involves light-dependent and light-independent reactions that ultimately produce energy-rich sugar molecules.' },
      ],
    },
  ];

  const handleParse = (data: { sourceType: string; text: string; sourceUrl?: string }) => {
    setSourceType(data.sourceType);
    setSourceText(data.text);
    setPreviewText(data.text.slice(0, 5000));
    
    // Auto-extract topics (mock)
    const extractedTopics = ['biology', 'photosynthesis', 'plant science'];
    setTopics(extractedTopics);
    
    setStage('config');
    toast.success('Content parsed successfully');
  };

  const handleGenerate = async (config: { mcqCount: number; difficulty: string; topics: string[] }) => {
    setStage('generating');
    toast.info('Starting MCQ generation...');

    // Mock generation steps
    // In production, this would call the backend edge function
    setTimeout(() => setStage('quiz'), 3000);
  };

  const handleAnswer = (response: string, isCorrect: boolean) => {
    // Record attempt
    console.log({ response, isCorrect });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < mockQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setStage('results');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleRetryIncorrect = () => {
    toast.info('Retry functionality coming soon');
  };

  const handleExport = () => {
    toast.info('Export functionality coming soon');
  };

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Study Helper</h1>
              <p className="text-xs text-muted-foreground">AI-powered MCQ generation</p>
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
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Preview</h3>
              <div className="bg-card rounded-lg p-6 shadow-medium h-[600px] overflow-y-auto">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {previewText || 'No preview available'}
                </p>
                {sourceText.length > 5000 && (
                  <button className="text-sm text-primary hover:underline mt-4">
                    Show more...
                  </button>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Configuration</h3>
              <ConfigCard
                topics={topics}
                onTopicsChange={setTopics}
                onGenerate={handleGenerate}
              />
            </div>
          </div>
        )}

        {stage === 'generating' && (
          <div className="max-w-2xl mx-auto">
            <GenerationProgress
              steps={[
                { label: 'Chunking text', status: 'completed' },
                { label: 'Indexing embeddings', status: 'active' },
                { label: 'Generating MCQs', status: 'pending' },
                { label: 'Validating questions', status: 'pending' },
                { label: 'Finalising', status: 'pending' },
              ]}
            />
          </div>
        )}

        {stage === 'quiz' && mockQuestions.length > 0 && (
          <MCQQuestion
            {...mockQuestions[currentQuestionIndex]}
            currentIndex={currentQuestionIndex}
            total={mockQuestions.length}
            onAnswer={handleAnswer}
            onNext={handleNextQuestion}
            onPrevious={handlePreviousQuestion}
            hasNext={currentQuestionIndex < mockQuestions.length - 1}
            hasPrevious={currentQuestionIndex > 0}
          />
        )}

        {stage === 'results' && (
          <ResultsSummary
            score={85}
            totalMs={180000}
            attempts={[
              {
                stem: 'What is the primary purpose of photosynthesis in plants?',
                chosen: 'B',
                correct: 'B',
                isCorrect: true,
              },
            ]}
            onRetryIncorrect={handleRetryIncorrect}
            onExport={handleExport}
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
