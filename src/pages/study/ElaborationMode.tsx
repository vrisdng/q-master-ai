import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookMarked, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  evaluateElaborationAnswer,
  fetchElaborationQuestions,
  summarizeElaborationSession,
  createStudySet,
  fetchDocumentById,
  type ElaborationEvaluation,
  type ElaborationQuestion,
  type ElaborationSessionSummary,
  type ElaborationSummaryInput,
} from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import GuestUpgradeCallout from "@/components/GuestUpgradeCallout";

const formatPercent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const clampQuestionCount = (value: number) => {
  if (Number.isNaN(value)) return 10;
  return Math.min(18, Math.max(4, Math.round(value)));
};

type Stage = "config" | "session";

type DifficultyOption = "mixed" | "core" | "advanced";

const difficultyChoices: Array<{
  value: DifficultyOption;
  label: string;
  description: string;
}> = [
  {
    value: "mixed",
    label: "Mixed",
    description: "Blend core and stretch prompts for a balanced run.",
  },
  {
    value: "core",
    label: "Core",
    description: "Focus on foundational causal links.",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Demand multi-step comparisons and hypotheticals.",
  },
];

interface QuestionState {
  answer: string;
  evaluation?: ElaborationEvaluation;
  lastSubmitted?: string;
  showModel?: boolean;
}

const DEFAULT_STATE: QuestionState = {
  answer: "",
  evaluation: undefined,
  lastSubmitted: undefined,
  showModel: false,
};

const ElaborationModePage = () => {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const { loading: authLoading, isGuest } = useAuth();

  const [stage, setStage] = useState<Stage>("config");
  const [isFetchingDoc, setIsFetchingDoc] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");

  const [requestedCount, setRequestedCount] = useState(10);
  const [requestedDifficulty, setRequestedDifficulty] = useState<DifficultyOption>("mixed");
  const [isGenerating, setIsGenerating] = useState(false);

  const [questions, setQuestions] = useState<ElaborationQuestion[]>([]);
  const [sessionConfig, setSessionConfig] = useState<{ questionCount: number; difficulty: DifficultyOption } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [harderMode, setHarderMode] = useState(false);
  const [summary, setSummary] = useState<ElaborationSessionSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [lastSummaryCount, setLastSummaryCount] = useState(0);
  const [studySetCreated, setStudySetCreated] = useState(false);
  const [isSavingStudySet, setIsSavingStudySet] = useState(false);

  useEffect(() => {
    if (!documentId) {
      navigate("/profile");
      return;
    }

    if (authLoading || isGuest) {
      if (!authLoading && isGuest) {
        setIsFetchingDoc(false);
      }
      return;
    }

    let active = true;
    setIsFetchingDoc(true);
    setDocError(null);

    fetchDocumentById(documentId)
      .then((doc) => {
        if (!active) return;
        setDocumentTitle(doc.title);
      })
      .catch((error) => {
        console.error("Failed to load document for elaboration mode", error);
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to open document";
        setDocError(message);
      })
      .finally(() => {
        if (active) {
          setIsFetchingDoc(false);
        }
      });

    return () => {
      active = false;
    };
  }, [documentId, navigate, authLoading, isGuest]);

  const updateQuestionState = useCallback((questionId: string, updater: (prev: QuestionState) => QuestionState) => {
    setQuestionStates((prev) => {
      const existing = prev[questionId] ?? DEFAULT_STATE;
      return {
        ...prev,
        [questionId]: updater(existing),
      };
    });
  }, []);

  const completedCount = useMemo(
    () =>
      Object.values(questionStates).reduce((acc, state) => (state.evaluation ? acc + 1 : acc), 0),
    [questionStates],
  );

  const evaluationEntries = useMemo(() => {
    if (!questions.length) return [] as ElaborationSummaryInput[];
    const entries: ElaborationSummaryInput[] = [];
    questions.forEach((question) => {
      const state = questionStates[question.id];
      if (!state?.evaluation) return;
      entries.push({
        question: question.prompt,
        highlights: state.evaluation.highlights,
        scores: state.evaluation.scores,
      });
    });
    return entries;
  }, [questions, questionStates]);

  const shouldWarnBeforeExit = useMemo(() => {
    if (stage !== "session") return false;
    if (studySetCreated) return false;
    if (!questions.length) return false;
    return completedCount < questions.length;
  }, [stage, studySetCreated, questions.length, completedCount]);

  useEffect(() => {
    if (!shouldWarnBeforeExit) return undefined;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldWarnBeforeExit]);

  const handleNavigateAway = useCallback(() => {
    if (shouldWarnBeforeExit) {
      const confirmed = window.confirm(
        "If you leave now, your elaboration session won't be saved as a study set. Do you still want to exit?",
      );
      if (!confirmed) {
        return;
      }
    }
    navigate("/profile");
  }, [navigate, shouldWarnBeforeExit]);

  const handleAnswerChange = useCallback(
    (value: string, question?: ElaborationQuestion) => {
      if (!question) return;
      const trimmed = value.trim();
      updateQuestionState(question.id, (prev) => {
        if (prev.lastSubmitted && prev.lastSubmitted !== trimmed) {
          return {
            answer: value,
            evaluation: undefined,
            lastSubmitted: undefined,
            showModel: false,
          };
        }

        return {
          ...prev,
          answer: value,
        };
      });
    },
    [updateQuestionState],
  );

  const evaluateCurrent = useCallback(
    async (question?: ElaborationQuestion, options?: { reveal?: boolean }) => {
      if (!question) return null;

      const state = questionStates[question.id] ?? DEFAULT_STATE;
      const trimmedAnswer = state.answer.trim();

      if (state.evaluation && state.lastSubmitted === trimmedAnswer) {
        if (options?.reveal && !state.showModel) {
          updateQuestionState(question.id, (prev) => ({
            ...prev,
            showModel: true,
          }));
        }
        return state.evaluation;
      }

      setIsEvaluating(true);
      try {
        const evaluation = await evaluateElaborationAnswer({ question, answer: state.answer });
        updateQuestionState(question.id, (prev) => ({
          ...prev,
          evaluation,
          lastSubmitted: trimmedAnswer,
          showModel: options?.reveal ? true : prev.showModel,
        }));
        toast.success("Evaluation ready");
        return evaluation;
      } catch (error) {
        console.error("Elaboration evaluation failed", error);
        const message = error instanceof Error ? error.message : "Unable to evaluate response";
        toast.error(message);
        throw error;
      } finally {
        setIsEvaluating(false);
      }
    },
    [questionStates, updateQuestionState],
  );

  const handleReveal = useCallback(
    async (question?: ElaborationQuestion) => {
      await evaluateCurrent(question, { reveal: true }).catch(() => undefined);
    },
    [evaluateCurrent],
  );

  const handleAnswer = useCallback(
    async (question?: ElaborationQuestion) => {
      await evaluateCurrent(question).catch(() => undefined);
    },
    [evaluateCurrent],
  );

  const gotoNextQuestion = useCallback(
    (questionList: ElaborationQuestion[], activeIndex: number) => {
      if (!questionList.length) return;

      const evaluatedIds = new Set(
        Object.entries(questionStates)
          .filter(([, state]) => Boolean(state?.evaluation))
          .map(([id]) => id),
      );

      let candidate: number | null = null;

      if (harderMode) {
        const advancedUnused = questionList
          .map((question, index) => ({ question, index }))
          .filter(({ question }) => question.difficulty === "advanced")
          .filter(({ question }) => !evaluatedIds.has(question.id));

        if (advancedUnused.length) {
          candidate = advancedUnused[0].index;
        }
      }

      if (candidate === null) {
        const unfinished = questionList
          .map((question, index) => ({ question, index }))
          .filter(({ question }) => !evaluatedIds.has(question.id));

        if (unfinished.length) {
          const afterCurrent = unfinished.find(({ index }) => index > activeIndex);
          candidate = afterCurrent ? afterCurrent.index : unfinished[0].index;
        }
      }

      if (candidate === null) {
        candidate = (activeIndex + 1) % questionList.length;
      }

      setCurrentIndex(candidate);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [harderMode, questionStates],
  );

  useEffect(() => {
    if (isGuest) return;
    if (!evaluationEntries.length) {
      setSummary(null);
      setLastSummaryCount(0);
      return;
    }

    if (stage !== "session") {
      return;
    }

    if (!documentTitle || evaluationEntries.length === lastSummaryCount) {
      return;
    }

    let cancelled = false;
    setIsSummarizing(true);

    summarizeElaborationSession({ documentTitle, evaluations: evaluationEntries })
      .then((result) => {
        if (cancelled) return;
        setSummary(result);
        setLastSummaryCount(evaluationEntries.length);
      })
      .catch((error) => {
        console.error("Failed to summarise elaboration session", error);
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to create session recap");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSummarizing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentTitle, evaluationEntries, lastSummaryCount, stage, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    if (stage !== "session") return;
    if (studySetCreated) return;
    if (!questions.length) return;
    if (completedCount !== questions.length) return;
    if (!documentId) return;
    if (isSavingStudySet) return;

    const buildStudySetText = () => {
      return questions
        .map((question, index) => {
          const state = questionStates[question.id] ?? DEFAULT_STATE;
          const evaluation = state.evaluation;
          const userAnswer = state.answer.trim();

          const lines: string[] = [
            `Prompt ${index + 1}: ${question.prompt}`,
          ];

          if (question.focus) {
            lines.push(`Focus: ${question.focus}`);
          }

          if (question.anchors.length) {
            lines.push(
              `Anchors: ${question.anchors.map((anchor) => `${anchor.label}`).join(", ")}`,
            );
          }

          lines.push(`Your elaboration: ${userAnswer || "(no response)"}`);

          if (evaluation) {
            lines.push(
              `Coverage: ${formatPercent(evaluation.scores.coverage.value)} — ${evaluation.scores.coverage.explanation}`,
            );
            lines.push(
              `Causal link: ${formatPercent(evaluation.scores.causal.value)} — ${evaluation.scores.causal.explanation}`,
            );
            lines.push(
              `Connection quality: ${formatPercent(evaluation.scores.connection.value)} — ${evaluation.scores.connection.explanation}`,
            );
            if (evaluation.highlights.correctIdeas.length) {
              lines.push(`Correct ideas: ${evaluation.highlights.correctIdeas.join("; ")}`);
            }
            if (evaluation.highlights.missingLinks.length) {
              lines.push(`Missing links: ${evaluation.highlights.missingLinks.join("; ")}`);
            }
            if (evaluation.highlights.suggestions.length) {
              lines.push(`Suggestions: ${evaluation.highlights.suggestions.join("; ")}`);
            }
            lines.push(`Model answer: ${evaluation.modelAnswer}`);
            if (evaluation.followUp) {
              lines.push(`Follow-up tip: ${evaluation.followUp}`);
            }
          } else {
            lines.push("(No evaluation on record)");
          }

          return lines.join("\n");
        })
        .join("\n\n---\n\n");
    };

    const saveStudySet = async () => {
      setIsSavingStudySet(true);
      try {
        const topics = Array.from(
          new Set(
            questions
              .map((question) => question.focus?.trim())
              .filter((focus): focus is string => Boolean(focus)),
          ),
        );

        const content = buildStudySetText();
        const now = new Date();
        const titleSuffix = now.toLocaleString();

        await createStudySet({
          title: `Elaboration session – ${documentTitle} (${titleSuffix})`,
          text: content,
          topics: topics.length ? topics : ["Elaboration"],
          config: {
            mode: "elaboration",
            questionCount: sessionConfig?.questionCount ?? questions.length,
            difficulty: sessionConfig?.difficulty ?? "mixed",
            savedAtIso: now.toISOString(),
          },
          sourceType: "text",
          documentId,
        });

        setStudySetCreated(true);
        toast.success("Elaboration study set saved to your library");
      } catch (error) {
        console.error("Failed to save elaboration study set", error);
        toast.error(error instanceof Error ? error.message : "Unable to save study set");
      } finally {
        setIsSavingStudySet(false);
      }
    };

    saveStudySet();
  }, [
    stage,
    studySetCreated,
    questions,
    completedCount,
    documentId,
    documentTitle,
    sessionConfig,
    questionStates,
    isSavingStudySet,
    isGuest,
  ]);

  const currentQuestion = stage === "session" ? questions[currentIndex] : undefined;
  const currentState = currentQuestion
    ? questionStates[currentQuestion.id] ?? DEFAULT_STATE
    : DEFAULT_STATE;

  const progressLabel = stage === "session"
    ? `${completedCount}/${questions.length} answered`
    : "";

  const evaluation = currentState.evaluation;

  const scoreItems = evaluation
    ? [
        { id: "coverage", label: "Coverage", data: evaluation.scores.coverage },
        { id: "causal", label: "Causal link", data: evaluation.scores.causal },
        { id: "connection", label: "Connection quality", data: evaluation.scores.connection },
      ]
    : [];

  const handleStartSession = useCallback(async () => {
    if (!documentId) return;

    const count = clampQuestionCount(requestedCount);
    setRequestedCount(count);
    setIsGenerating(true);
    setStudySetCreated(false);
    setSummary(null);
    setLastSummaryCount(0);

    try {
      const result = await fetchElaborationQuestions(documentId, {
        questionCount: count,
        difficulty: requestedDifficulty,
      });

      setQuestions(result.questions);
      setSessionConfig({
        questionCount: result.config.questionCount,
        difficulty: result.config.difficulty,
      });
      setQuestionStates({});
      setCurrentIndex(0);
      setHarderMode(result.config.difficulty === "advanced");
      setStage("session");
      toast.success(`Generated ${result.questions.length} elaboration prompts`);
    } catch (error) {
      console.error("Failed to generate elaboration questions", error);
      const message = error instanceof Error ? error.message : "Unable to generate elaboration prompts";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [documentId, requestedCount, requestedDifficulty]);

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <div className="text-sm text-muted-foreground">Checking access…</div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <GuestUpgradeCallout
          description="Elaboration practice is available once you create an account. Unlock adaptive prompts, feedback, and saved study sets by upgrading."
        />
      </div>
    );
  }

  if (isFetchingDoc) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading document…</span>
        </div>
      </div>
    );
  }

  if (docError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
        <Button type="button" variant="ghost" className="w-fit" onClick={handleNavigateAway}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to documents
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Unable to open Elaboration Mode</AlertTitle>
          <AlertDescription>{docError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (stage === "config") {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
        <Button type="button" variant="ghost" className="w-fit" onClick={handleNavigateAway}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to documents
        </Button>

        <Card className="shadow-md">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Configure Elaboration Mode</CardTitle>
            <CardDescription>
              Choose how many prompts you want and their difficulty before generating AI-guided elaboration cards for
              <span className="ml-1 font-medium text-foreground">{documentTitle}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="question-count">Number of questions</Label>
                <Input
                  id="question-count"
                  type="number"
                  min={4}
                  max={18}
                  value={requestedCount}
                  onChange={(event) => setRequestedCount(clampQuestionCount(Number(event.target.value) || requestedCount))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Pick between 4 and 18 prompts for this run.</p>
              </div>
              <div className="space-y-2">
                <Label>Difficulty mix</Label>
                <RadioGroup
                  value={requestedDifficulty}
                  onValueChange={(value) => setRequestedDifficulty(value as DifficultyOption)}
                  className="grid gap-2"
                >
                  {difficultyChoices.map((choice) => (
                    <label
                      key={choice.value}
                      className="flex cursor-pointer flex-col rounded-md border border-muted-foreground/30 p-3 text-sm hover:border-primary"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem id={`difficulty-${choice.value}`} value={choice.value} />
                        <span className="font-medium text-foreground">{choice.label}</span>
                      </div>
                      <p className="ml-7 mt-1 text-xs text-muted-foreground">{choice.description}</p>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
            <Alert>
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>
                Your elaboration session automatically saves as a study set after you complete every prompt once. Leaving early
                means the session will not be stored.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" onClick={handleStartSession} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate prompts
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
        <Button type="button" variant="ghost" className="w-fit" onClick={handleNavigateAway}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to documents
        </Button>
        <Alert>
          <AlertTitle>No questions available</AlertTitle>
          <AlertDescription>
            We couldn’t generate elaboration prompts for this document yet. Try adjusting your configuration and generating
            again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button type="button" variant="ghost" className="w-fit" onClick={handleNavigateAway}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to documents
        </Button>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <BookMarked className="h-4 w-4" />
            <span className="font-medium text-foreground">{documentTitle}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{progressLabel}</span>
            <div className="flex items-center gap-2">
              <Switch id="harder-mode" checked={harderMode} onCheckedChange={setHarderMode} />
              <label htmlFor="harder-mode" className="text-xs text-muted-foreground">
                Ask for harder question
              </label>
            </div>
          </div>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">Question {currentIndex + 1}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={currentQuestion.difficulty === "advanced" ? "destructive" : "secondary"}>
                {currentQuestion.difficulty === "advanced" ? "Advanced" : "Core"}
              </Badge>
              {currentQuestion.focus ? (
                <Badge variant="outline" className="text-xs">
                  {currentQuestion.focus}
                </Badge>
              ) : null}
            </div>
          </div>
          <CardDescription className="text-base text-foreground">{currentQuestion.prompt}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-2 text-xs uppercase text-muted-foreground tracking-wide">Anchored excerpts</p>
            <div className="grid gap-3 md:grid-cols-2">
              {currentQuestion.anchors.map((anchor) => (
                <div key={anchor.chunkId} className="rounded-md border border-muted-foreground/20 bg-muted/30 p-3 text-xs leading-relaxed">
                  <p className="mb-1 font-medium text-muted-foreground">{anchor.label}</p>
                  <p className="text-muted-foreground/90">{anchor.excerpt}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Type your elaboration</span>
              {currentState.lastSubmitted && currentState.lastSubmitted === currentState.answer.trim() && evaluation ? (
                <span className="text-primary">Evaluated</span>
              ) : null}
            </div>
            <Textarea
              value={currentState.answer}
              onChange={(event) => handleAnswerChange(event.target.value, currentQuestion)}
              placeholder="Explain the idea in depth, make causal links, and connect back to the source."
              className="min-h-[160px] resize-y"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => handleReveal(currentQuestion)} disabled={isEvaluating}>
            {isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reveal answer
          </Button>
          <Button type="button" onClick={() => handleAnswer(currentQuestion)} disabled={isEvaluating}>
            {isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Answer
          </Button>
          <Button type="button" variant="secondary" onClick={() => gotoNextQuestion(questions, currentIndex)}>
            Next
          </Button>
        </CardFooter>
      </Card>

      {evaluation ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">AI feedback</CardTitle>
            <CardDescription>How your elaboration stacked up</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {scoreItems.map((item) => (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <div className="rounded-md border border-primary/30 bg-background p-3 shadow-sm">
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>{item.label}</span>
                        <span>{formatPercent(item.data.value)}</span>
                      </div>
                      <Progress value={Math.round(item.data.value * 100)} className="mt-2 h-2" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-relaxed">
                    {item.data.explanation || "No explanation provided."}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-3">
              {[{
                title: "Correct ideas captured",
                items: evaluation.highlights.correctIdeas,
                empty: "Note the core mechanisms next time you respond.",
              }, {
                title: "Missing logical links",
                items: evaluation.highlights.missingLinks,
                empty: "No gaps flagged here!",
              }, {
                title: "Suggestions",
                items: evaluation.highlights.suggestions,
                empty: "You’re in good shape—push for even deeper links.",
              }].map((section) => (
                <div key={section.title} className="rounded-md border border-primary/20 bg-background p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/80">
                    {section.title}
                  </p>
                  {section.items.length ? (
                    <ul className="space-y-2 text-sm text-foreground/90">
                      {section.items.map((item) => (
                        <li key={item} className="leading-relaxed">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{section.empty}</p>
                  )}
                </div>
              ))}
            </div>

            {evaluation.followUp ? (
              <Alert className="bg-background/80">
                <AlertTitle>Next attempt tip</AlertTitle>
                <AlertDescription>{evaluation.followUp}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {currentState.showModel && evaluation ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Model answer</CardTitle>
            <CardDescription>Compare your reasoning with the expert elaboration.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {evaluation.modelAnswer}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Concept recap</CardTitle>
            <CardDescription>
              Mini summary of concepts you explained well versus those needing more work. We’ll save the study set once you finish
              every prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-muted-foreground/20 bg-muted/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Concepts you explained well
              </p>
              {summary.conceptsExplainedWell.length ? (
                <ul className="space-y-2 text-sm text-foreground/90">
                  {summary.conceptsExplainedWell.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keep building evidence—no highlights yet.</p>
              )}
            </div>
            <div className="rounded-md border border-muted-foreground/20 bg-muted/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Concepts needing elaboration
              </p>
              {summary.conceptsNeedingElaboration.length ? (
                <ul className="space-y-2 text-sm text-foreground/90">
                  {summary.conceptsNeedingElaboration.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nice work—no major gaps detected.</p>
              )}
            </div>
            <div className="rounded-md border border-muted-foreground/20 bg-muted/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suggested next steps
              </p>
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating recap…
                </div>
              ) : summary.studyTips.length ? (
                <ul className="space-y-2 text-sm text-foreground/90">
                  {summary.studyTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No extra tips yet—try another question.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {studySetCreated ? (
        <Alert className="border-primary/40 bg-primary/10">
          <AlertTitle>Study set saved</AlertTitle>
          <AlertDescription>
            This session’s elaboration prompts are now stored in your study library. Feel free to continue refining answers or start a
            new configuration from the profile page.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};

export default ElaborationModePage;
