import { useState } from 'react';
import { Loader2, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ConfigCardProps {
  onGenerate: (config: { mcqCount: number; difficulty: string }) => void;
  isGenerating?: boolean;
}

export const ConfigCard = ({ onGenerate, isGenerating = false }: ConfigCardProps) => {
  const [mcqCount, setMcqCount] = useState(12);
  const [difficulty, setDifficulty] = useState('medium');

  const handleGenerate = () => {
    onGenerate({ mcqCount, difficulty });
  };

  return (
    <Card className="p-6 shadow-medium">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Configuration</h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mcqCount">Number of MCQs</Label>
          <Input
            id="mcqCount"
            type="number"
            min={5}
            max={50}
            value={mcqCount}
            onChange={(e) => setMcqCount(parseInt(e.target.value) || 12)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Between 5 and 50 questions</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty Level</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger id="difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerate}
          className="w-full gradient-primary hover:opacity-90 gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate MCQs
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
