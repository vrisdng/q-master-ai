import { useState } from 'react';
import { CheckCircle, XCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Option {
  label: string;
  text: string;
}

interface Source {
  chunkId: string;
  excerpt: string;
}

interface MCQQuestionProps {
  stem: string;
  options: Option[];
  answerKey: string;
  solution: string;
  sources: Source[];
  currentIndex: number;
  total: number;
  onAnswer: (response: string, isCorrect: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const MCQQuestion = ({
  stem,
  options,
  answerKey,
  solution,
  sources,
  currentIndex,
  total,
  onAnswer,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: MCQQuestionProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [startTime] = useState(Date.now());

  const handleCheck = () => {
    if (!selectedOption) return;
    const isCorrect = selectedOption === answerKey;
    const timeMs = Date.now() - startTime;
    onAnswer(selectedOption, isCorrect);
    setIsChecked(true);
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsChecked(false);
    onNext();
  };

  const handlePrevious = () => {
    setSelectedOption(null);
    setIsChecked(false);
    onPrevious();
  };

  const isCorrect = isChecked && selectedOption === answerKey;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Question {currentIndex + 1} of {total}</span>
          <span>{Math.round((currentIndex / total) * 100)}% complete</span>
        </div>
        <Progress value={(currentIndex / total) * 100} className="h-2" />
      </div>

      <Card className="p-8 shadow-medium">
        <h3 className="text-xl font-semibold mb-6 leading-relaxed">{stem}</h3>

        <RadioGroup
          value={selectedOption || ''}
          onValueChange={setSelectedOption}
          disabled={isChecked}
          className="space-y-4"
        >
          {options.map((option) => {
            const isSelected = selectedOption === option.label;
            const isAnswer = option.label === answerKey;
            const showCorrect = isChecked && isAnswer;
            const showIncorrect = isChecked && isSelected && !isAnswer;

            return (
              <div
                key={option.label}
                className={`
                  relative flex items-start space-x-3 p-4 rounded-lg border-2 transition-smooth
                  ${!isChecked && 'hover:border-primary/50 cursor-pointer'}
                  ${isSelected && !isChecked && 'border-primary bg-accent'}
                  ${showCorrect && 'border-success bg-success/10'}
                  ${showIncorrect && 'border-destructive bg-destructive/10'}
                `}
              >
                <RadioGroupItem value={option.label} id={option.label} className="mt-1" />
                <Label htmlFor={option.label} className="flex-1 cursor-pointer">
                  <span className="font-medium">{option.label}.</span> {option.text}
                </Label>
                {showCorrect && <CheckCircle className="h-5 w-5 text-success" />}
                {showIncorrect && <XCircle className="h-5 w-5 text-destructive" />}
              </div>
            );
          })}
        </RadioGroup>

        {!isChecked && (
          <Button
            onClick={handleCheck}
            disabled={!selectedOption}
            className="w-full mt-6 gradient-primary hover:opacity-90"
          >
            Check Answer
          </Button>
        )}

        {isChecked && (
          <div className={`mt-6 p-4 rounded-lg ${isCorrect ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <h4 className={`font-semibold ${isCorrect ? 'text-success' : 'text-destructive'}`}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </h4>
            </div>
            <p className="text-sm leading-relaxed mb-4">{solution}</p>

            <Collapsible>
              <CollapsibleTrigger className="text-sm font-medium text-primary hover:underline">
                View Source Excerpts
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {sources.map((source, idx) => (
                  <div key={idx} className="text-sm p-3 bg-muted/50 rounded border border-border">
                    <p className="italic text-muted-foreground">"{source.excerpt}"</p>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        {hasPrevious && (
          <Button
            variant="outline"
            onClick={handlePrevious}
            className="flex-1 gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        )}
        {hasNext && isChecked && (
          <Button
            onClick={handleNext}
            className="flex-1 gap-2 gradient-primary hover:opacity-90"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
