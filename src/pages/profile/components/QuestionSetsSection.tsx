import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface QuestionSet {
  id: string;
  title: string;
  createdAt: string;
  topics: string[] | null;
  text: string;
}

interface QuestionSetsSectionProps {
  studySets: QuestionSet[];
  onDeleteStudySet: (studySetId: string) => void;
  onReviewStudySet: (studySetId: string) => void;
}

export const QuestionSetsSection = ({
  studySets,
  onDeleteStudySet,
  onReviewStudySet,
}: QuestionSetsSectionProps) => {
  if (!studySets.length) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Question Sets</h2>
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
          No question sets created yet.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Question Sets</h2>
      <ul className="space-y-3">
        {studySets.map((set) => {
          const preview = set.text.slice(0, 200) + (set.text.length > 200 ? "…" : "");

          return (
            <li key={set.id} className="rounded-lg border border-muted-foreground/10 bg-card p-4 shadow-sm space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{set.title}</p>
                  <p className="text-xs text-muted-foreground">Created {new Date(set.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 self-end sm:self-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReviewStudySet(set.id)}
                    className="flex items-center gap-1"
                  >
                    <ModelTrainingIcon fontSize="small" className="h-4 w-4" />
                    Review
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteStudySet(set.id)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                {preview}
              </div>
              {set.topics && set.topics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {set.topics.map((topic) => (
                    <span key={topic} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
