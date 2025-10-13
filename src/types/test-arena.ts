import type { MockExamIntensity, MockExamQuestion, MockExamQuestionResult, MockExamEvaluation } from "./mock-exam";

export interface TestQuestionPlan {
  mcq: number;
  fillInTheBlank: number;
  matching: number;
  essay: { count: number; wordCount: number };
  shortAnswer: { count: number; wordCount: number };
}

export interface TestDefinition {
  id: string;
  title: string;
  description?: string | null;
  intensity: MockExamIntensity;
  timerEnabled: boolean;
  questionPlan: TestQuestionPlan;
  folderIds: string[];
  documentIds: string[];
  status: "draft" | "ready" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface TestRun {
  id: string;
  testId: string;
  status: "configured" | "in_progress" | "completed" | "cancelled";
  questions: MockExamQuestion[];
  timer: {
    enabled: boolean;
    suggestedMinutes: number;
  };
  startedAt?: string;
  completedAt?: string;
}

export interface TestEvaluationSummary {
  overallScore: number;
  breakdownByType: Array<{
    type: MockExamQuestion["type"];
    score: number;
    questions: number;
  }>;
  masteryHeatmap: Array<{
    concept: string;
    score: number;
    attempts: number;
  }>;
  reviewQueue: Array<{
    questionId: string;
    prompt: string;
    yourAnswer: string | null;
    correctAnswer: string | null;
    rationale: string;
    sources: Array<{ excerpt: string; label?: string }>;
    quickActions: Array<"retry" | "flashcard" | "note" | "generateVariants">;
  }>;
}

export interface TestEvaluation extends Omit<MockExamEvaluation, "highlights"> {
  highlights: MockExamEvaluation["highlights"];
  breakdownByType: TestEvaluationSummary["breakdownByType"];
  masteryHeatmap: TestEvaluationSummary["masteryHeatmap"];
  reviewQueue: TestEvaluationSummary["reviewQueue"];
}

export interface TestRunResult {
  run: TestRun;
  evaluation: TestEvaluation;
}
