import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface GenerationProgressProps {
  steps: Step[];
  onCancel?: () => void;
}

export const GenerationProgress = ({ steps, onCancel }: GenerationProgressProps) => {
  return (
    <Card className="p-8 shadow-medium">
      <h3 className="text-xl font-semibold mb-6">Generating your MCQs...</h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-4">
            {step.status === 'completed' && (
              <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
            )}
            {step.status === 'active' && (
              <Loader2 className="h-6 w-6 text-primary animate-spin flex-shrink-0" />
            )}
            {step.status === 'pending' && (
              <Circle className="h-6 w-6 text-muted-foreground flex-shrink-0" />
            )}
            {step.status === 'error' && (
              <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
            )}
            
            <div className="flex-1">
              <p className={`font-medium ${
                step.status === 'active' ? 'text-primary' :
                step.status === 'completed' ? 'text-success' :
                step.status === 'error' ? 'text-destructive' :
                'text-muted-foreground'
              }`}>
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {onCancel && (
        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full mt-6"
        >
          Cancel
        </Button>
      )}
    </Card>
  );
};
