import { Award, CheckCircle2, FileOutput, Flame, RotateCcw, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MockExam } from "@/types/mock-exam";
import type { TestEvaluation } from "@/types/test-arena";

interface MockExamResultsProps {
  exam: MockExam;
  evaluation: TestEvaluation;
  onNewExam: () => void;
  onBackToProfile?: () => void;
  isPersisting?: boolean;
  studySetId?: string;
  onQuickAction?: (params: {
    questionId: string;
    action: "retry" | "flashcard" | "note" | "generateVariants";
  }) => void;
}

export const MockExamResults = ({
  exam,
  evaluation,
  onNewExam,
  onBackToProfile,
  isPersisting = false,
  studySetId,
  onQuickAction,
}: MockExamResultsProps) => {
  const totalQuestions = evaluation.details.length;
  const highScore = evaluation.overallScore >= 70;

  const handleQuickAction = (
    questionId: string,
    action: "retry" | "flashcard" | "note" | "generateVariants",
  ) => {
    if (onQuickAction) {
      onQuickAction({ questionId, action });
      return;
    }

    switch (action) {
      case "retry":
        toast.info("Retry queued", {
          description: "We’ll spin up a focused drill on this prompt soon.",
        });
        break;
      case "flashcard":
        toast.success("Added to flashcards", {
          description: "You’ll see this in your flashcard deck shortly.",
        });
        break;
      case "note":
        toast.info("Note saved", {
          description: "Jot down deeper thoughts in the Notes panel anytime.",
        });
        break;
      case "generateVariants":
        toast.info("Variants requested", {
          description: "More TAP-style follow-ups are on the way.",
        });
        break;
      default:
        toast.info("Action queued");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-8 text-center shadow-emphasis gradient-primary">
        <Award className="h-16 w-16 mx-auto mb-4 text-primary-foreground" />
        <h2 className="text-3xl font-bold text-primary-foreground mb-2">
          {evaluation.overallScore}%
        </h2>
        <p className="text-primary-foreground/90">
          {highScore
            ? "Great job! You're building strong mastery."
            : "Progress is progress—keep refining your understanding."}
        </p>
        <p className="mt-2 text-sm text-primary-foreground/80">
          Exam intensity: {exam.intensity} • Questions answered: {totalQuestions}
        </p>
      </Card>

      <Card className="p-6 shadow-medium space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">What went well</h3>
          {evaluation.highlights.strengths.length > 0 ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {evaluation.highlights.strengths.map((item, index) => (
                <li key={`strength-${index}`} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keep practising to uncover your standout strengths.
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold mb-2">Focus areas</h4>
            {evaluation.highlights.weakAreas.length > 0 ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {evaluation.highlights.weakAreas.map((item, index) => (
                  <li key={`weak-${index}`} className="flex gap-2">
                    <span className="text-destructive font-medium">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No major weak spots detected—aim for deeper synthesis next time.
              </p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Suggestions</h4>
            {evaluation.highlights.suggestions.length > 0 ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {evaluation.highlights.suggestions.map((item, index) => (
                  <li key={`suggestion-${index}`} className="flex gap-2">
                    <span className="text-primary font-medium">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keep revisiting previous exams or create a new one to stay sharp.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-medium space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Immediate score by type
            </h4>
            <div className="space-y-3">
              {evaluation.breakdownByType.map((entry) => (
                <div key={entry.type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="font-medium text-foreground capitalize">
                      {entry.type.replace(/-/g, " ")}
                    </span>
                    <span>{Math.round(entry.score)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all",
                        entry.score >= 70
                          ? "bg-emerald-500"
                          : entry.score >= 40
                          ? "bg-amber-500"
                          : "bg-rose-500",
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, entry.score))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.questions} question{entry.questions === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Mastery heatmap
            </h4>
            <div className="flex flex-wrap gap-3">
              {evaluation.masteryHeatmap.map((concept) => {
                const tone =
                  concept.score >= 75
                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-200"
                    : concept.score >= 45
                    ? "bg-amber-500/15 text-amber-600 border-amber-200"
                    : "bg-rose-500/15 text-rose-600 border-rose-200";
                return (
                  <div
                    key={concept.concept}
                    className={cn(
                      "rounded-xl border px-4 py-3 shadow-inner transition-colors",
                      tone,
                    )}
                  >
                    <p className="text-sm font-semibold capitalize">{concept.concept}</p>
                    <p className="text-xs">
                      Score {Math.round(concept.score)}% • {concept.attempts} attempt
                      {concept.attempts === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              })}
              {evaluation.masteryHeatmap.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Complete more tests to unlock your mastery heatmap.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {evaluation.reviewQueue.length > 0 && (
        <Card className="p-6 shadow-medium space-y-4 border-dashed border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Immediate review
              </h3>
              <p className="text-sm text-muted-foreground">
                Revisit the items you missed or felt unsure about—right now while the memory trace is fresh.
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1 border-primary/40 text-primary">
              <Flame className="h-3.5 w-3.5" />
              {evaluation.reviewQueue.length} to review
            </Badge>
          </div>

          <div className="space-y-4">
            {evaluation.reviewQueue.map((item) => (
              <div key={item.questionId} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{item.prompt}</p>
                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 md:gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                      Your answer
                    </p>
                    <p className="text-sm text-destructive font-medium">
                      {item.yourAnswer ?? "No response"}
                    </p>
                  </div>
                  {item.correctAnswer && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                        Correct answer
                      </p>
                      <p className="text-sm text-success font-medium">{item.correctAnswer}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{item.rationale}</p>

                {item.sources.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Sources
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {item.sources.map((source, idx) => (
                        <li key={`${item.questionId}-source-${idx}`} className="rounded bg-muted px-2 py-1">
                          {source.label ? <strong>{source.label}: </strong> : null}
                          “{source.excerpt}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    onClick={() => handleQuickAction(item.questionId, "retry")}
                  >
                    <Zap className="h-4 w-4" />
                    Retry now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAction(item.questionId, "flashcard")}
                  >
                    Convert to flashcard
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAction(item.questionId, "note")}
                  >
                    Add custom note
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAction(item.questionId, "generateVariants")}
                  >
                    More TAP variants
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 shadow-medium space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Question-by-question feedback</h3>
          {studySetId && (
            <Badge variant="outline" className="flex items-center gap-1">
              <FileOutput className="h-3.5 w-3.5" />
              Saved as study set
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {evaluation.details.map((detail, index) => {
            const question = exam.questions.find((q) => q.id === detail.questionId);
            const typeLabel = question?.type ?? "unknown";
            const scorePercent = Math.round((detail.score / detail.outOf) * 100);

            return (
              <div
                key={detail.questionId}
                className="p-4 border border-border rounded-lg bg-card space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-muted-foreground">
                      Q{index + 1} • {typeLabel.replace(/-/g, " ")}
                    </p>
                    <p className="mt-1 text-base font-medium text-foreground">
                      {question?.prompt}
                    </p>
                  </div>
                  <Badge variant={detail.isCorrect ? "default" : detail.isCorrect === false ? "destructive" : "secondary"}>
                    {scorePercent}%
                  </Badge>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 md:gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                      Your answer
                    </p>
                    <p className="text-sm text-foreground">
                      {detail.yourAnswer ?? "No response"}
                    </p>
                  </div>
                  {detail.correctAnswer && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                        Correct answer
                      </p>
                      <p className="text-sm text-success">{detail.correctAnswer}</p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">{detail.feedback}</p>

                <div className="grid gap-3 md:grid-cols-2">
                  {detail.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Strengths
                      </p>
                      <ul className="mt-1 space-y-1">
                        {detail.strengths.map((item, idx) => (
                          <li key={`detail-strength-${idx}`} className="text-sm text-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detail.improvements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Improvements
                      </p>
                      <ul className="mt-1 space-y-1">
                        {detail.improvements.map((item, idx) => (
                          <li key={`detail-improve-${idx}`} className="text-sm text-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onBackToProfile && (
          <Button variant="outline" onClick={onBackToProfile}>
            View Library
          </Button>
        )}
        <Button onClick={onNewExam} disabled={isPersisting} className="gap-2 gradient-primary">
          <RotateCcw className="h-4 w-4" />
          {isPersisting ? "Saving..." : "Generate Another Mock Exam"}
        </Button>
      </div>
    </div>
  );
};

MockExamResults.displayName = "MockExamResults";
