import { useState } from 'react';
import { Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface ConfigCardProps {
  topics: string[];
  onTopicsChange: (topics: string[]) => void;
  onGenerate: (config: { mcqCount: number; difficulty: string; topics: string[] }) => void;
}

export const ConfigCard = ({ topics, onTopicsChange, onGenerate }: ConfigCardProps) => {
  const [mcqCount, setMcqCount] = useState(12);
  const [difficulty, setDifficulty] = useState('medium');
  const [newTopic, setNewTopic] = useState('');

  const addTopic = () => {
    if (newTopic.trim() && !topics.includes(newTopic.trim())) {
      onTopicsChange([...topics, newTopic.trim()]);
      setNewTopic('');
    }
  };

  const removeTopic = (topic: string) => {
    onTopicsChange(topics.filter((t) => t !== topic));
  };

  const handleGenerate = () => {
    onGenerate({ mcqCount, difficulty, topics });
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

        <div className="space-y-2">
          <Label htmlFor="topics">Topic Tags</Label>
          <div className="flex gap-2">
            <Input
              id="topics"
              placeholder="Add a topic..."
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTopic()}
            />
            <Button onClick={addTopic} variant="secondary" size="sm">
              Add
            </Button>
          </div>
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {topics.map((topic) => (
                <Badge
                  key={topic}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-smooth"
                  onClick={() => removeTopic(topic)}
                >
                  {topic} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={handleGenerate}
          className="w-full gradient-primary hover:opacity-90 gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Generate MCQs
        </Button>
      </div>
    </Card>
  );
};
