export type MockExamType =
  | "mcq"
  | "fill-in-the-blank"
  | "essay"
  | "matching"
  | "short-answer";

export type MockExamIntensity = "light" | "standard" | "intense";

export interface MockExamConfigRequirement {
  type: MockExamType;
  count: number;
  targetWordCount?: number;
}

export interface MockExamGenerationConfig {
  documentId: string;
  intensity: MockExamIntensity;
  timerEnabled: boolean;
  requirements: MockExamConfigRequirement[];
}

export interface MockExamTimerConfig {
  enabled: boolean;
  suggestedMinutes: number;
}

export interface MockExamQuestionBase {
  id: string;
  type: MockExamType;
  prompt: string;
  intensity: MockExamIntensity;
  sources?: Array<{ excerpt: string; label?: string; referenceId?: string }>;
  referenceIds?: string[];
}

export interface MockExamMCQOption {
  label: string;
  text: string;
}

export interface MockExamMCQQuestion extends MockExamQuestionBase {
  type: "mcq";
  options: MockExamMCQOption[];
  answerKey: string;
  explanation: string;
}

export interface MockExamFillQuestion extends MockExamQuestionBase {
  type: "fill-in-the-blank";
  answer: string;
  explanation: string;
}

export interface MockExamMatchingPair {
  prompt: string;
  answer: string;
}

export interface MockExamMatchingQuestion extends MockExamQuestionBase {
  type: "matching";
  pairs: MockExamMatchingPair[];
  explanation: string;
}

export interface MockExamEssayQuestion extends MockExamQuestionBase {
  type: "essay";
  targetWordCount: number;
  idealResponse: string;
  rubric: string[];
}

export interface MockExamShortAnswerQuestion extends MockExamQuestionBase {
  type: "short-answer";
  targetWordCount: number;
  keyPoints: string[];
  idealResponse: string;
}

export type MockExamQuestion =
  | MockExamMCQQuestion
  | MockExamFillQuestion
  | MockExamMatchingQuestion
  | MockExamEssayQuestion
  | MockExamShortAnswerQuestion;

export interface MockExam {
  examId: string;
  documentTitle: string;
  intensity: MockExamIntensity;
  timer: MockExamTimerConfig;
  questions: MockExamQuestion[];
}

export interface MockExamResponse {
  questionId: string;
  response:
    | string
    | null
    | Array<{ prompt: string; answer: string }>
    | Record<string, unknown>;
}

export interface MockExamQuestionResult {
  questionId: string;
  score: number;
  outOf: number;
  isCorrect: boolean | null;
  feedback: string;
  strengths: string[];
  improvements: string[];
  yourAnswer?: string | null;
  correctAnswer?: string | null;
}

export interface MockExamEvaluation {
  examId: string;
  documentTitle: string;
  intensity: MockExamIntensity;
  overallScore: number;
  details: MockExamQuestionResult[];
  highlights: {
    strengths: string[];
    weakAreas: string[];
    suggestions: string[];
  };
}

export interface PersistedMockExamSummary {
  studySetId: string;
  folderId: string;
}
