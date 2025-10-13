import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Folder,
  Loader2,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MockExamTimer } from "@/components/mock-exam/MockExamTimer";
import { MockExamResults } from "@/components/mock-exam/MockExamResults";
import {
  createTest,
  listTests,
  startTestRun,
  submitTestRun,
  fetchTestRun,
  deleteTest,
  type CreateTestInput,
} from "@/lib/api";
import type { MockExamQuestion, MockExamResponse } from "@/types/mock-exam";
import type { TestDefinition, TestRun, TestEvaluation } from "@/types/test-arena";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

type Stage = "dashboard" | "taking" | "review";

type MatchingResponseMap = Record<string, string>;
type ResponseState = Record<string, string | MatchingResponseMap>;

const DEFAULT_PLAN: CreateTestInput["questionPlan"] = {
  mcq: 8,
  fillInTheBlank: 4,
  matching: 2,
  essay: { count: 1, wordCount: 180 },
  shortAnswer: { count: 2, wordCount: 80 },
};

const INTENSITY_OPTIONS = [
  { value: "light", label: "Light", description: "Concept warm-up with core recall." },
  { value: "standard", label: "Standard", description: "Balanced mix of recall and application." },
  { value: "intense", label: "Intense", description: "Advanced synthesis and nuance." },
] as const;

const wordCountOptions = [
  { value: 120, label: "≈120 words" },
  { value: 180, label: "≈180 words" },
  { value: 240, label: "≈240 words" },
  { value: 320, label: "≈320 words" },
] as const;

const shortAnswerWordOptions = [
  { value: 50, label: "≈50 words" },
  { value: 80, label: "≈80 words" },
  { value: 120, label: "≈120 words" },
] as const;

const TestMode = () => {
  const navigate = useNavigate();
  const { documents, folders, isLoading: profileLoading } = useProfile();

  const [stage, setStage] = useState<Stage>("dashboard");
  const [tests, setTests] = useState<TestDefinition[]>([]);
  const [activeTest, setActiveTest] = useState<TestDefinition | null>(null);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runEvaluation, setRunEvaluation] = useState<TestEvaluation | null>(null);
  const [responses, setResponses] = useState<ResponseState>({});
  const [matchingOptionsCache, setMatchingOptionsCache] = useState<Record<string, string[]>>({});
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const [timerRemainingMs, setTimerRemainingMs] = useState<number | null>(null);
  const [timerTotalMs, setTimerTotalMs] = useState<number | null>(null);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createState, setCreateState] = useState<CreateTestInput>({
    title: "",
    description: "",
    intensity: "standard",
    timerEnabled: true,
    questionPlan: DEFAULT_PLAN,
    folderIds: [],
    documentIds: [],
  });
  const [createStep, setCreateStep] = useState(1);
  const [createLoading, setCreateLoading] = useState(false);
  const creationSteps = [
    { index: 1, label: "Basics" },
    { index: 2, label: "Sources" },
    { index: 3, label: "Blueprint" },
    { index: 4, label: "Review" },
  ] as const;
  const totalCreateSteps = creationSteps.length;
  const totalPlannedQuestions =
    createState.questionPlan.mcq +
    createState.questionPlan.fillInTheBlank +
    createState.questionPlan.matching +
    createState.questionPlan.essay.count +
    createState.questionPlan.shortAnswer.count;
  const hasSources = createState.folderIds.length + createState.documentIds.length > 0;
  const canProceed = useMemo(() => {
    switch (createStep) {
      case 1:
        return createState.title.trim().length > 0;
      case 2:
        return hasSources;
      case 3:
        return totalPlannedQuestions > 0;
      default:
        return true;
    }
  }, [createStep, createState.title, hasSources, totalPlannedQuestions]);
  const canCreate = useMemo(
    () => createState.title.trim().length > 0 && hasSources && totalPlannedQuestions > 0,
    [createState.title, hasSources, totalPlannedQuestions],
  );
  const selectedDocuments = useMemo(
    () => documents.filter((doc) => createState.documentIds.includes(doc.id)),
    [documents, createState.documentIds],
  );
  const selectedFolders = useMemo(
    () => folders.filter((folder) => createState.folderIds.includes(folder.id)),
    [folders, createState.folderIds],
  );

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const resetTimerState = useCallback(() => {
    clearTimer();
    setTimerRemainingMs(null);
    setTimerTotalMs(null);
    setAutoSubmitTriggered(false);
  }, [clearTimer]);

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setCreateStep(1);
    } else {
      setCreateStep(1);
    }
  }, []);

  const goToNextStep = useCallback(() => {
    setCreateStep((prev) => Math.min(prev + 1, totalCreateSteps));
  }, [totalCreateSteps]);

  const goToPreviousStep = useCallback(() => {
    setCreateStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const loadTests = useCallback(async () => {
    setIsLoadingTests(true);
    try {
      const data = await listTests();
      setTests(data);
    } catch (error) {
      console.error("Failed to load tests", error);
      toast.error(error instanceof Error ? error.message : "Failed to load tests");
    } finally {
      setIsLoadingTests(false);
    }
  }, []);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const totalQuestions = useMemo(() => {
    if (!activeRun) return 0;
    return activeRun.questions.length;
  }, [activeRun]);

  const resetRunState = useCallback(() => {
    resetTimerState();
    setActiveRun(null);
    setRunEvaluation(null);
    setResponses({});
    setMatchingOptionsCache({});
    setIsSubmitting(false);
    setIsPersisting(false);
  }, [resetTimerState]);

  const handleCreateTest = useCallback(async () => {
    if (!createState.title.trim()) {
      toast.error("Give your test a name so you can find it later.");
      return;
    }
    if (
      createState.questionPlan.mcq +
        createState.questionPlan.fillInTheBlank +
        createState.questionPlan.matching +
        createState.questionPlan.essay.count +
        createState.questionPlan.shortAnswer.count ===
      0
    ) {
      toast.error("Add at least one question to your plan.");
      return;
    }

    setCreateLoading(true);
    try {
      const created = await createTest({
        ...createState,
        title: createState.title.trim(),
        description: createState.description?.trim() ?? null,
      });
      setTests((prev) => [created, ...prev]);
      setCreateStep(1);
      setCreateDialogOpen(false);
      setCreateState({
        title: "",
        description: "",
        intensity: "standard",
        timerEnabled: true,
        questionPlan: DEFAULT_PLAN,
        folderIds: [],
        documentIds: [],
      });
      toast.success("Test blueprint saved", {
        description: "Start it right away or return later from Test Arena.",
      });
    } catch (error) {
      console.error("Failed to create test", error);
      toast.error(error instanceof Error ? error.message : "Unable to create test");
    } finally {
      setCreateLoading(false);
    }
  }, [createState]);

  const handleStartTest = useCallback(
    async (test: TestDefinition) => {
      setStage("taking");
      setActiveTest(test);
      setIsSubmitting(false);
      setIsPersisting(false);
      resetTimerState();

      try {
        const run = await startTestRun(test.id);
        setActiveRun(run);

        const initialResponses: ResponseState = {};
        const matchingOptions: Record<string, string[]> = {};

        run.questions.forEach((question) => {
          switch (question.type) {
            case "mcq":
              initialResponses[question.id] = "";
              break;
            case "matching":
              initialResponses[question.id] = {};
              matchingOptions[question.id] = shuffleArray(
                question.pairs.map((pair) => pair.answer),
              );
              break;
            default:
              initialResponses[question.id] = "";
          }
        });

        setResponses(initialResponses);
        setMatchingOptionsCache(matchingOptions);

        if (run.timer.enabled) {
          const total = Math.max(run.timer.suggestedMinutes, 1) * 60 * 1000;
          setTimerTotalMs(total);
          setTimerRemainingMs(total);
          setAutoSubmitTriggered(false);
        } else {
          setTimerTotalMs(null);
          setTimerRemainingMs(null);
          setAutoSubmitTriggered(false);
        }
      } catch (error) {
        console.error("Failed to start test", error);
        toast.error(error instanceof Error ? error.message : "Unable to start test");
        setStage("dashboard");
        setActiveTest(null);
        resetRunState();
      }
    },
    [resetRunState, resetTimerState],
  );

  useEffect(() => {
    if (stage !== "taking" || timerRemainingMs === null || autoSubmitTriggered) {
      if (stage !== "taking") {
        clearTimer();
      }
      return;
    }

    if (timerIntervalRef.current !== null) {
      return;
    }

    timerIntervalRef.current = window.setInterval(() => {
      setTimerRemainingMs((prev) => {
        if (prev === null) return prev;
        const next = prev - 1000;
        if (next <= 0) {
          if (timerIntervalRef.current !== null) {
            window.clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearTimer();
    };
  }, [stage, timerRemainingMs !== null, autoSubmitTriggered, clearTimer]);

  const handleResponseChange = useCallback(
    (questionId: string, value: string | MatchingResponseMap) => {
      setResponses((prev) => ({
        ...prev,
        [questionId]: value,
      }));
    },
    [],
  );

  const formatResponsesForSubmission = useCallback((): MockExamResponse[] => {
    if (!activeRun) return [];

    return activeRun.questions.map((question) => {
      const raw = responses[question.id];
      switch (question.type) {
        case "matching": {
          const map = (raw ?? {}) as MatchingResponseMap;
          const pairs = Object.entries(map).map(([prompt, answer]) => ({
            prompt,
            answer,
          }));
          return {
            questionId: question.id,
            response: pairs,
          };
        }
        default:
          return {
            questionId: question.id,
            response: typeof raw === "string" ? raw : "",
          };
      }
    });
  }, [activeRun, responses]);

  const handleSubmitRun = useCallback(async ({ auto = false }: { auto?: boolean } = {}) => {
    if (!activeRun || !activeTest) {
      toast.error("Nothing to submit yet—start a test first.");
      return;
    }

    if (auto) {
      setAutoSubmitTriggered(true);
    }

    clearTimer();
    setTimerRemainingMs(null);
    setTimerTotalMs(null);

    setIsSubmitting(true);
    try {
      const payload = formatResponsesForSubmission();
      const { run, evaluation } = await submitTestRun(activeTest.id, activeRun.id, payload);
      setActiveRun(run);
      setRunEvaluation(evaluation);
      setStage("review");
    } catch (error) {
      console.error("Failed to submit run", error);
      toast.error(error instanceof Error ? error.message : "Unable to score test");
    } finally {
      setIsSubmitting(false);
    }
  }, [activeRun, activeTest, formatResponsesForSubmission, clearTimer]);

  useEffect(() => {
    if (stage === "taking" && timerRemainingMs === 0 && !autoSubmitTriggered && !isSubmitting) {
      toast.warning("Time is up! Submitting your answers…");
      setAutoSubmitTriggered(true);
      void handleSubmitRun({ auto: true });
    }
  }, [stage, timerRemainingMs, autoSubmitTriggered, isSubmitting, handleSubmitRun]);

  const handleReviewAction = useCallback(
    async (action: "retry" | "flashcard" | "note" | "generateVariants", questionId: string) => {
      if (!activeTest || !activeRun) return;

      switch (action) {
        case "retry":
          toast.info("Retry session coming soon", {
            description: "We’ll surface a focused follow-up loop in the next release.",
          });
          break;
        case "flashcard":
          toast.success("Added to flashcards");
          break;
        case "note":
          toast.info("Note captured");
          break;
        case "generateVariants":
          toast.info("Generating TAP variants…");
          break;
        default:
          toast.info("Action queued");
      }

      // Optionally re-fetch run to check for updates if needed
      try {
        const data = await fetchTestRun(activeTest.id, activeRun.id);
        if (data.evaluation) {
          setRunEvaluation(data.evaluation);
        }
      } catch {
        // ignore
      }
    },
    [activeRun, activeTest],
  );

  const handleBackToDashboard = useCallback(async () => {
    setStage("dashboard");
    setActiveTest(null);
    resetRunState();
    await loadTests();
  }, [loadTests, resetRunState]);

  const handleDeleteTest = useCallback(async (testId: string) => {
    const confirmed = window.confirm("Delete this test blueprint? This action cannot be undone.");
    if (!confirmed) return;

    setDeletingTestId(testId);
    try {
      await deleteTest(testId);
      setTests((prev) => prev.filter((test) => test.id !== testId));
      toast.success("Test blueprint deleted");
    } catch (error) {
      console.error("Failed to delete test", error);
      toast.error(error instanceof Error ? error.message : "Unable to delete test");
    } finally {
      setDeletingTestId(null);
    }
  }, []);

  const renderDashboard = () => (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Test Arena
          </h1>
          <p className="text-sm text-muted-foreground">
            Design bespoke mock exams, launch Test Mode, and monitor mastery by concept.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create test
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create a custom test</DialogTitle>
                <DialogDescription>
                  Work through the steps to fine-tune your mock exam. You can always revisit earlier steps before saving.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  {creationSteps.map((step, index) => (
                    <div key={step.index} className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                          createStep === step.index
                            ? "border-primary bg-primary text-primary-foreground"
                            : createStep > step.index
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {step.index}
                      </div>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          createStep === step.index ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {step.label}
                      </span>
                      {index !== creationSteps.length - 1 && (
                        <div className="hidden h-px w-6 bg-border md:block" />
                      )}
                    </div>
                  ))}
                </div>

                {createStep === 1 && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="test-name">Test name</Label>
                        <Input
                          id="test-name"
                          placeholder="e.g. Midterm checkpoint"
                          value={createState.title}
                          onChange={(event) =>
                            setCreateState((prev) => ({ ...prev, title: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="test-intensity">Intensity</Label>
                        <div className="grid gap-2">
                          {INTENSITY_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setCreateState((prev) => ({ ...prev, intensity: option.value }))
                              }
                              className={cn(
                                "rounded-lg border px-3 py-2 text-left transition-smooth",
                                createState.intensity === option.value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border hover:border-primary/40",
                              )}
                            >
                              <span className="text-sm font-medium">{option.label}</span>
                              <p className="text-xs text-muted-foreground">{option.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="test-description">Description (optional)</Label>
                        <Textarea
                          id="test-description"
                          placeholder="Add context or goals for this test…"
                          value={createState.description ?? ""}
                          onChange={(event) =>
                            setCreateState((prev) => ({ ...prev, description: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-semibold">Timer mode</Label>
                            <p className="text-xs text-muted-foreground">
                              Enable a countdown—when time expires, the test submits automatically.
                            </p>
                          </div>
                          <Switch
                            checked={createState.timerEnabled}
                            onCheckedChange={(checked) =>
                              setCreateState((prev) => ({ ...prev, timerEnabled: checked }))
                            }
                          />
                        </div>
                        <Card className="p-3 text-xs text-muted-foreground bg-muted/60">
                          Prefer to work untimed? Leave this off and you can submit whenever you’re ready.
                        </Card>
                      </div>
                    </div>
                  </div>
                )}

                {createStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select the folders or individual documents that should power this mock exam. Add more content from your library if needed.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <SelectorCard
                        title="Folders"
                        icon={<Folder className="h-4 w-4 text-primary" />}
                        emptyLabel="No folders yet—organise your library to see them here."
                        items={folders.map((folder) => ({
                          id: folder.id,
                          label: folder.name,
                        }))}
                        selectedIds={createState.folderIds}
                        onToggle={(id) => {
                          setCreateState((prev) => ({
                            ...prev,
                            folderIds: prev.folderIds.includes(id)
                              ? prev.folderIds.filter((value) => value !== id)
                              : [...prev.folderIds, id],
                          }));
                        }}
                      />
                      <SelectorCard
                        title="Documents"
                        icon={<FileText className="h-4 w-4 text-primary" />}
                        emptyLabel="Upload notes or study material in your library to select them here."
                        items={documents.map((doc) => ({
                          id: doc.id,
                          label: doc.title,
                        }))}
                        selectedIds={createState.documentIds}
                        onToggle={(id) => {
                          setCreateState((prev) => ({
                            ...prev,
                            documentIds: prev.documentIds.includes(id)
                              ? prev.documentIds.filter((value) => value !== id)
                              : [...prev.documentIds, id],
                          }));
                        }}
                      />
                    </div>
                  </div>
                )}

                {createStep === 3 && (
                  <QuestionPlanEditor
                    plan={createState.questionPlan}
                    onPlanChange={(plan) =>
                      setCreateState((prev) => ({
                        ...prev,
                        questionPlan: plan,
                      }))
                    }
                  />
                )}

                {createStep === 4 && (
                  <div className="space-y-4">
                    <Card className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Overview
                      </h4>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium text-foreground">{createState.title || "Untitled test"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Intensity</span>
                          <span className="font-medium capitalize text-foreground">{createState.intensity}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Timer</span>
                          <span className="font-medium text-foreground">{createState.timerEnabled ? "Auto-submit when time is up" : "Manual submission"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Question count</span>
                          <span className="font-medium text-foreground">{totalPlannedQuestions}</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Sources
                      </h4>
                      {selectedFolders.length === 0 && selectedDocuments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No folders or documents selected yet.
                        </p>
                      ) : (
                        <div className="space-y-3 text-sm">
                          {selectedFolders.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Folders</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                                {selectedFolders.map((folder) => (
                                  <li key={folder.id}>{folder.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedDocuments.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Documents</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                                {selectedDocuments.map((doc) => (
                                  <li key={doc.id}>{doc.title}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>

                    <Card className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Question blueprint
                      </h4>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Multiple-choice</span>
                          <span className="font-medium text-foreground">{createState.questionPlan.mcq}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Fill in the blank</span>
                          <span className="font-medium text-foreground">{createState.questionPlan.fillInTheBlank}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Matching</span>
                          <span className="font-medium text-foreground">{createState.questionPlan.matching}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Essay</span>
                          <span className="font-medium text-foreground">
                            {createState.questionPlan.essay.count} × ~{createState.questionPlan.essay.wordCount} words
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Short answer</span>
                          <span className="font-medium text-foreground">
                            {createState.questionPlan.shortAnswer.count} × ~{createState.questionPlan.shortAnswer.wordCount} words
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleCreateDialogOpenChange(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <div className="flex gap-2">
                  {createStep > 1 && (
                    <Button type="button" variant="outline" onClick={goToPreviousStep} disabled={createLoading}>
                      Back
                    </Button>
                  )}
                  {createStep < totalCreateSteps ? (
                    <Button
                      type="button"
                      onClick={() => {
                        if (canProceed) {
                          goToNextStep();
                        }
                      }}
                      disabled={!canProceed}
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleCreateTest} disabled={createLoading || !canCreate}>
                      {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      <span className="ml-2">Create test</span>
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" onClick={() => navigate("/profile")}>
            Back to profile
          </Button>
        </div>
      </div>

      <Card className="p-6 shadow-medium space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Your test blueprints
          </h2>
          <Button variant="outline" size="sm" onClick={() => void loadTests()} disabled={isLoadingTests}>
            {isLoadingTests ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {tests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              You haven’t created any tests yet. Start with “Create test” to design your first Test Mode experience.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {tests.map((test) => {
              const total =
                test.questionPlan.mcq +
                test.questionPlan.fillInTheBlank +
                test.questionPlan.matching +
                test.questionPlan.essay.count +
                test.questionPlan.shortAnswer.count;

              return (
                <Card key={test.id} className="p-5 space-y-4 border border-border/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{test.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {test.description || "No description provided."}
                      </p>
                    </div>
                    <Badge variant={test.status === "archived" ? "secondary" : "default"}>
                      {test.intensity}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">{total}</strong> questions • Timer{" "}
                      {test.timerEnabled ? "on" : "off"}
                    </p>
                    <p>
                      MCQ {test.questionPlan.mcq} • Fill-in {test.questionPlan.fillInTheBlank} • Matching{" "}
                      {test.questionPlan.matching}
                    </p>
                    <p>
                      Essay {test.questionPlan.essay.count} × ~{test.questionPlan.essay.wordCount} words • Short answer{" "}
                      {test.questionPlan.shortAnswer.count} × ~{test.questionPlan.shortAnswer.wordCount} words
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      Documents linked: {test.documentIds.length} • Folders linked: {test.folderIds.length}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleDeleteTest(test.id)}
                        disabled={deletingTestId === test.id}
                      >
                        {deletingTestId === test.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                      </Button>
                      <Button onClick={() => void handleStartTest(test)} className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Start test
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );

  const renderRun = () => {
    if (!activeRun || !activeTest) return null;

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="p-6 shadow-medium">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Test Arena • {activeTest.intensity} intensity
            </p>
            <h1 className="text-2xl font-semibold">{activeTest.title}</h1>
            <p className="text-sm text-muted-foreground">
              {activeTest.description || "Answer the questions below to get an instant mastery report."}
            </p>
          </div>
        </Card>

        <MockExamTimer
          enabled={activeRun.timer.enabled}
          suggestedMinutes={activeRun.timer.suggestedMinutes}
          remainingMs={timerRemainingMs ?? undefined}
          totalMs={timerTotalMs ?? undefined}
        />

        <div className="space-y-4">
          {activeRun.questions.map((question, index) => (
            <Card key={question.id} className="p-6 shadow-medium space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {question.type.replace(/-/g, " ")}
                    </Badge>
                    {question.sources && question.sources.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Grounded in source excerpts
                      </span>
                    )}
                  </div>
                  <p className="text-base font-medium text-foreground">{question.prompt}</p>
                  <div>{renderQuestionInput(question)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleBackToDashboard}>
            Exit without submitting
          </Button>
          <Button onClick={handleSubmitRun} disabled={isSubmitting} className="gap-2 gradient-primary">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isSubmitting ? "Scoring…" : "Submit for scoring"}
          </Button>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    if (!activeRun || !activeTest || !runEvaluation) return null;

    return (
      <MockExamResults
        exam={{
          examId: activeRun.id,
          documentTitle: activeTest.title,
          intensity: activeTest.intensity,
          timer: activeRun.timer,
          questions: activeRun.questions,
        }}
        evaluation={runEvaluation}
        onNewExam={() => {
          setStage("dashboard");
          setActiveTest(null);
          resetRunState();
        }}
        onBackToProfile={() => navigate("/profile")}
        isPersisting={isPersisting}
        onQuickAction={({ action, questionId }) => void handleReviewAction(action, questionId)}
      />
    );
  };

  const renderQuestionInput = (question: MockExamQuestion) => {
    const value = responses[question.id];
    switch (question.type) {
      case "mcq":
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map((option) => {
              const selected = value === option.label;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleResponseChange(question.id, option.label)}
                  className={cn(
                    "text-left rounded-lg border px-4 py-3 transition-smooth",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="font-medium">{option.label}</span>.{" "}
                  <span className="text-sm text-muted-foreground">{option.text}</span>
                </button>
              );
            })}
          </div>
        );
      case "fill-in-the-blank":
        return (
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(event) => handleResponseChange(question.id, event.target.value)}
            placeholder="Type the missing phrase…"
          />
        );
      case "matching": {
        const mapValue = (value ?? {}) as MatchingResponseMap;
        const options = matchingOptionsCache[question.id] ?? [];

        return (
          <div className="space-y-3">
            {question.pairs.map((pair) => (
              <div key={`${question.id}-${pair.prompt}`} className="grid gap-2 md:grid-cols-2 md:items-center">
                <Label className="text-sm font-medium text-foreground">{pair.prompt}</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={mapValue[pair.prompt] ?? ""}
                  onChange={(event) =>
                    handleResponseChange(question.id, {
                      ...mapValue,
                      [pair.prompt]: event.target.value,
                    })
                  }
                >
                  <option value="">Select match</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        );
      }
      case "essay":
        return (
          <div className="space-y-2">
            <Textarea
              value={typeof value === "string" ? value : ""}
              onChange={(event) => handleResponseChange(question.id, event.target.value)}
              placeholder={`Aim for around ${question.targetWordCount} words.`}
              className="min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Keep a clear structure—your evaluator is paying attention to clarity and depth.
            </p>
          </div>
        );
      case "short-answer":
        return (
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(event) => handleResponseChange(question.id, event.target.value)}
            placeholder={`Aim for ${question.targetWordCount} words.`}
            className="min-h-[140px]"
          />
        );
      default:
        return null;
    }
  };

  if (profileLoading && stage === "dashboard") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Test Arena…</p>
        </div>
      </div>
    );
  }

  if (stage === "taking") {
    return renderRun();
  }

  if (stage === "review") {
    return renderReview();
  }

  return renderDashboard();
};

const shuffleArray = <T,>(input: T[]): T[] => {
  const clone = [...input];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

interface SelectorCardProps {
  title: string;
  icon: React.ReactNode;
  emptyLabel: string;
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}

const SelectorCard = ({ title, icon, emptyLabel, items, selectedIds, onToggle }: SelectorCardProps) => (
  <Card className="p-4 space-y-3 border border-dashed border-border">
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </span>
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground">
          Select as many as you like—documents take priority over folders.
        </p>
      </div>
    </div>

    <div className="max-h-40 overflow-y-auto pr-1">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-border"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  </Card>
);

interface QuestionPlanEditorProps {
  plan: CreateTestInput["questionPlan"];
  onPlanChange: (plan: CreateTestInput["questionPlan"]) => void;
}

const QuestionPlanEditor = ({ plan, onPlanChange }: QuestionPlanEditorProps) => (
  <Card className="p-4 border border-dashed border-border space-y-4">
    <div className="flex items-center gap-2">
      <BookOpen className="h-5 w-5 text-primary" />
      <div>
        <h4 className="text-sm font-semibold">Question blueprint</h4>
        <p className="text-xs text-muted-foreground">
          Mix question types to align with how you want to be challenged.
        </p>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <NumericField
        label="Multiple-choice"
        description="Four options, one correct answer."
        value={plan.mcq}
        onChange={(value) => onPlanChange({ ...plan, mcq: clamp(value, 0, 20) })}
      />
      <NumericField
        label="Fill in the blank"
        description="Targeted recall of key terminology."
        value={plan.fillInTheBlank}
        onChange={(value) => onPlanChange({ ...plan, fillInTheBlank: clamp(value, 0, 12) })}
      />
      <NumericField
        label="Matching"
        description="Pair concepts, examples, or sequences."
        value={plan.matching}
        onChange={(value) => onPlanChange({ ...plan, matching: clamp(value, 0, 8) })}
      />
      <div className="grid gap-2">
        <NumericField
          label="Essay questions"
          description="Long-form synthesis prompts."
          value={plan.essay.count}
          onChange={(value) =>
            onPlanChange({
              ...plan,
              essay: { ...plan.essay, count: clamp(value, 0, 4) },
            })
          }
        />
        <Label className="text-xs text-muted-foreground">Target word count</Label>
        <div className="flex flex-wrap gap-2">
          {wordCountOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onPlanChange({
                  ...plan,
                  essay: { ...plan.essay, wordCount: option.value },
                })
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-smooth",
                plan.essay.wordCount === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <NumericField
          label="Short answer"
          description="Concise constructed responses."
          value={plan.shortAnswer.count}
          onChange={(value) =>
            onPlanChange({
              ...plan,
              shortAnswer: { ...plan.shortAnswer, count: clamp(value, 0, 6) },
            })
          }
        />
        <Label className="text-xs text-muted-foreground">Target word count</Label>
        <div className="flex flex-wrap gap-2">
          {shortAnswerWordOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onPlanChange({
                  ...plan,
                  shortAnswer: { ...plan.shortAnswer, wordCount: option.value },
                })
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-smooth",
                plan.shortAnswer.wordCount === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  </Card>
);

interface NumericFieldProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

const NumericField = ({ label, description, value, onChange }: NumericFieldProps) => (
  <div className="space-y-2">
    <Label className="text-sm font-semibold">{label}</Label>
    <p className="text-xs text-muted-foreground">{description}</p>
    <Input
      type="number"
      min={0}
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
    />
  </div>
);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default TestMode;
