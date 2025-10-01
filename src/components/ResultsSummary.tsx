import { Award, Download, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AttemptResult {
  stem: string;
  chosen: string;
  correct: string;
  isCorrect: boolean;
}

interface ResultsSummaryProps {
  score: number;
  totalMs: number;
  attempts: AttemptResult[];
  onRetryIncorrect: () => void;
  onExport: () => void;
}

export const ResultsSummary = ({
  score,
  totalMs,
  attempts,
  onRetryIncorrect,
  onExport,
}: ResultsSummaryProps) => {
  const totalQuestions = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const timeMinutes = Math.floor(totalMs / 60000);
  const timeSeconds = Math.floor((totalMs % 60000) / 1000);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-8 text-center shadow-emphasis gradient-primary">
        <Award className="h-16 w-16 mx-auto mb-4 text-primary-foreground" />
        <h2 className="text-3xl font-bold text-primary-foreground mb-2">
          {score}%
        </h2>
        <p className="text-primary-foreground/90">
          You scored {correctCount} out of {totalQuestions} questions correctly
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-primary-foreground/80">
          <Clock className="h-4 w-4" />
          <span className="text-sm">
            Completed in {timeMinutes}m {timeSeconds}s
          </span>
        </div>
      </Card>

      <Card className="p-6 shadow-medium">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Question Summary</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRetryIncorrect} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Retry Incorrect
            </Button>
            <Button variant="outline" onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {attempts.map((attempt, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-smooth"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-2 line-clamp-2">
                  {attempt.stem}
                </p>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Your answer: <span className={attempt.isCorrect ? 'text-success' : 'text-destructive'}>
                      {attempt.chosen}
                    </span>
                  </span>
                  {!attempt.isCorrect && (
                    <span className="text-muted-foreground">
                      Correct: <span className="text-success">{attempt.correct}</span>
                    </span>
                  )}
                </div>
              </div>

              <Badge variant={attempt.isCorrect ? 'default' : 'destructive'}>
                {attempt.isCorrect ? 'Correct' : 'Incorrect'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
