import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const extractFunctionErrorReason = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const context = (error as { context?: unknown }).context;
  if (typeof context !== "object" || context === null) return undefined;
  const reason = (context as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
};

export interface ParseResponse {
  text: string;
  topics: string;
  approxTokens: number;
}

export type StudySetConfig = {
  mcqCount?: number;
  difficulty?: string;
  topics?: string[];
  [key: string]: unknown;
};

export interface StudySet {
  id: string;
  title: string;
  text: string;
  topics: string[];
  config: StudySetConfig;
  sourceType: "pdf" | "text" | "url";
  sourceUrl: string | null;
  sourceDocumentId: string | null;
  createdAt: string;
}

export interface MCQItem {
  id: string;
  stem: string;
  options: { label: string; text: string }[];
  answer_key: string;
  solution: string;
  difficulty: string;
  sources: { chunkId?: string; excerpt: string }[];
}

export interface UserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  role: "guest" | "user" | "admin";
}

export interface ProfileCapabilities {
  role: "guest" | "user" | "admin";
  canUseStudyModes: boolean;
  quotas: { documents: number; studySets: number } | null;
}

export interface ProfileDocument {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  sourceType: string;
  storagePath: string | null;
  status: string;
  pageCount: number | null;
  contentSha: string | null;
  metadata: Record<string, unknown>;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStudySet {
  id: string;
  ownerId: string | null;
  title: string;
  createdAt: string;
  sourceType: string;
  sourceUrl: string | null;
  topics: string[] | null;
  config: Record<string, unknown>;
  sourceDocumentId: string | null;
  text: string;
  folderId: string | null;
  labelText: string | null;
  labelColor: string | null;
}

export interface ProfileFolder {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  profile: UserProfile;
  documents: ProfileDocument[];
  studySets: ProfileStudySet[];
  folders: ProfileFolder[];
  capabilities?: ProfileCapabilities;
}

export interface DocumentDetail {
  id: string;
  title: string;
  sourceType: string;
  content: string;
  createdAt: string;
}

export interface SummaryKeyPoint {
  id: string;
  label: string;
  summary: string;
  evidence: string;
  importance: number;
}

export interface SummaryKeyPointResponse {
  keyPoints: SummaryKeyPoint[];
  wordTarget: number;
}

export interface SummaryExample {
  summary: string;
  wordCount: number;
  wordTarget: number;
}

export interface SummaryEvaluation {
  coverage: {
    score: number;
    covered: number;
    total: number;
    missed: { id: string; label: string; reason: string }[];
  };
  conciseness: {
    score: number;
    comment: string;
  };
  originality: {
    score: number;
    comment: string;
  };
  strengths: string[];
  improvements: string[];
  rewriteHints: string[];
  wordTarget: number;
}

export interface ElaborationAnchor {
  chunkId: string;
  label: string;
  excerpt: string;
  text: string;
}

export interface ElaborationQuestion {
  id: string;
  prompt: string;
  difficulty: "standard" | "advanced";
  modelAnswer: string;
  focus?: string;
  anchors: ElaborationAnchor[];
}

export interface ElaborationMetric {
  value: number;
  explanation: string;
}

export interface ElaborationEvaluation {
  scores: {
    coverage: ElaborationMetric;
    causal: ElaborationMetric;
    connection: ElaborationMetric;
  };
  highlights: {
    correctIdeas: string[];
    missingLinks: string[];
    suggestions: string[];
  };
  modelAnswer: string;
  followUp?: string;
}

export interface ElaborationSessionSummary {
  conceptsExplainedWell: string[];
  conceptsNeedingElaboration: string[];
  studyTips: string[];
}

export interface ElaborationSummaryInput {
  question: string;
  highlights: ElaborationEvaluation["highlights"];
  scores: ElaborationEvaluation["scores"];
}

/**
 * Parse content from various sources
 */
export const parseContent = async (
  sourceType: string,
  text?: string,
  url?: string
): Promise<ParseResponse> => {
  const { data, error } = await supabase.functions.invoke("parse-content", {
    body: { sourceType, text, url },
  });

  if (error) throw error;
  return data;
};

/**
 * Create a document record
 */
export const createDocument = async (params: {
  title: string;
  sourceType: string;
  sourceUrl?: string;
  folderId?: string | null;
  content: string;
}): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase.functions.invoke<{ id?: string }>("create-document", {
    body: {
      title: params.title,
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl,
      folderId: params.folderId ?? null,
      content: params.content,
    },
  });

  if (error) {
    const reason = extractFunctionErrorReason(error);
    if (reason === "documents_quota") {
      throw new Error("Guest limit reached: upgrade to upload more documents.");
    }
    throw new Error(error.message ?? "Failed to create document");
  }

  if (!data?.id) {
    throw new Error("Document creation failed: missing id");
  }

  return data.id;
};

export const fetchDocumentById = async (documentId: string): Promise<DocumentDetail> => {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, source_type, metadata, created_at")
    .eq("id", documentId)
    .maybeSingle<Database["public"]["Tables"]["documents"]["Row"]>();

  if (error) throw error;
  if (!data) throw new Error("Document not found");

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const content = metadata.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Document has no stored content");
  }

  return {
    id: data.id,
    title: data.title,
    sourceType: data.source_type,
    content,
    createdAt: data.created_at,
  };
};

/**
 * Create a new study set
 */
export const createStudySet = async (params: {
  title: string;
  text: string;
  topics: string[];
  config: StudySetConfig;
  sourceType: "pdf" | "text" | "url";
  sourceUrl?: string;
  documentId?: string;
}): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase.functions.invoke<{ id?: string }>("create-study-set", {
    body: {
      title: params.title,
      text: params.text,
      topics: params.topics,
      config: params.config,
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl ?? null,
      documentId: params.documentId ?? null,
    },
  });

  if (error) {
    const reason = extractFunctionErrorReason(error);
    if (reason === "study_sets_quota") {
      throw new Error("Guest limit reached: upgrade to generate more study sets.");
    }
    throw new Error(error.message ?? "Failed to create study set");
  }

  if (!data?.id) {
    throw new Error("Study set creation failed: missing id");
  }

  return data.id;
};

export const deleteStudySet = async (studySetId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("study_sets")
    .delete()
    .eq("id", studySetId);

  if (error) throw error;
};

/**
 * Generate MCQs for a study set
 */
export const generateMCQs = async (
  studySetId: string
): Promise<{ status: string; counts: { mcq: number } }> => {
  const { data, error } = await supabase.functions.invoke("generate-mcqs", {
    body: { studySetId },
  });

  if (error) throw error;
  return data;
};

export const fetchSummaryKeyPoints = async (documentId: string): Promise<SummaryKeyPointResponse> => {
  const { data, error } = await supabase.functions.invoke<{ data?: SummaryKeyPointResponse }>(
    "summarize-document",
    {
      body: { action: "key-points", documentId },
    },
  );

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to load key points");

  return data.data;
};

export const fetchExampleSummary = async (documentId: string): Promise<SummaryExample> => {
  const { data, error } = await supabase.functions.invoke<{ data?: { summary: string; wordCount: number; wordTarget: number } }>(
    "summarize-document",
    {
      body: { action: "example-summary", documentId },
    },
  );

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to load example summary");

  return {
    summary: data.data.summary,
    wordCount: data.data.wordCount,
    wordTarget: data.data.wordTarget,
  };
};

export const evaluateSummary = async (
  documentId: string,
  params: { summary: string; keyPoints: SummaryKeyPoint[] },
): Promise<SummaryEvaluation> => {
  const payloadKeyPoints = params.keyPoints.map((kp) => ({
    id: kp.id,
    label: kp.label,
    summary: kp.summary,
    evidence: kp.evidence,
  }));

  const { data, error } = await supabase.functions.invoke<{ data?: SummaryEvaluation }>(
    "summarize-document",
    {
      body: {
        action: "evaluate-summary",
        documentId,
        userSummary: params.summary,
        keyPoints: payloadKeyPoints,
      },
    },
  );

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to evaluate summary");

  return data.data;
};

export const fetchElaborationQuestions = async (
  documentId: string,
  options?: { questionCount?: number; difficulty?: "mixed" | "core" | "advanced" },
): Promise<{
  document: { id: string; title: string };
  questions: ElaborationQuestion[];
  config: { questionCount: number; difficulty: "mixed" | "core" | "advanced" };
}> => {
  const { data, error } = await supabase.functions.invoke<{
    data?: {
      document: { id: string; title: string };
      questions: ElaborationQuestion[];
      config?: { questionCount?: number; difficulty?: string };
    };
  }>("elaboration-mode", {
    body: {
      action: "generate-questions",
      documentId,
      questionCount: options?.questionCount,
      difficulty: options?.difficulty,
    },
  });

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to load elaboration prompts");

  const questionCount = data.data.config?.questionCount ?? data.data.questions.length;
  const difficulty = (data.data.config?.difficulty as "mixed" | "core" | "advanced" | undefined) ?? "mixed";

  return {
    document: data.data.document,
    questions: data.data.questions,
    config: {
      questionCount,
      difficulty,
    },
  };
};

export const evaluateElaborationAnswer = async (
  params: { question: ElaborationQuestion; answer: string },
): Promise<ElaborationEvaluation> => {
  const { data, error } = await supabase.functions.invoke<{ data?: ElaborationEvaluation }>(
    "elaboration-mode",
    {
      body: {
        action: "evaluate-answer",
        question: params.question,
        userAnswer: params.answer,
      },
    },
  );

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to score elaboration");

  return data.data;
};

export const summarizeElaborationSession = async (
  params: { documentTitle: string; evaluations: ElaborationSummaryInput[] },
): Promise<ElaborationSessionSummary> => {
  const { data, error } = await supabase.functions.invoke<{ data?: ElaborationSessionSummary }>(
    "elaboration-mode",
    {
      body: {
        action: "summarize-session",
        documentTitle: params.documentTitle,
        evaluations: params.evaluations,
      },
    },
  );

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to generate recap");

  return data.data;
};

/**
 * Fetch study set with items
 */
export const fetchStudySet = async (studySetId: string): Promise<{
  studySet: StudySet;
  items: MCQItem[];
}> => {
  const { data: studySet, error: studySetError } = await supabase
    .from("study_sets")
    .select("*")
    .eq("id", studySetId)
    .single();

  if (studySetError) throw studySetError;
  if (!studySet) throw new Error("Study set not found");

  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("*")
    .eq("study_set_id", studySetId)
    .order("created_at");

  if (itemsError) throw itemsError;

  const sourceType = (studySet.source_type ?? "text") as StudySet["sourceType"];

  const typedStudySet: StudySet = {
    id: studySet.id,
    title: studySet.title,
    text: studySet.text,
    topics: (studySet.topics ?? []) as string[],
    config: studySet.config as StudySet["config"],
    sourceType,
    sourceUrl: studySet.source_url,
    sourceDocumentId: studySet.source_document_id,
    createdAt: studySet.created_at,
  };

  return {
    studySet: typedStudySet,
    items: (items ?? []) as unknown as MCQItem[],
  };
};

/**
 * Create a quiz session
 */
export const createQuizSession = async (
  studySetId: string,
  questionIds: string[]
): Promise<string> => {
  const { data, error } = await supabase
    .from("quiz_sessions")
    .insert({
      study_set_id: studySetId,
      question_ids: questionIds,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

/**
 * Record an attempt
 */
export const recordAttempt = async (
  sessionId: string,
  itemId: string,
  response: string,
  isCorrect: boolean,
  timeMs: number
): Promise<void> => {
  const { error } = await supabase.from("attempts").insert({
    session_id: sessionId,
    item_id: itemId,
    response,
    is_correct: isCorrect,
    time_ms: timeMs,
  });

  if (error) throw error;
};

/**
 * Complete a quiz session
 */
export const completeQuizSession = async (
  sessionId: string,
  score: number,
  totalMs: number
): Promise<void> => {
  const { error } = await supabase
    .from("quiz_sessions")
    .update({
      completed_at: new Date().toISOString(),
      score,
      time_total_ms: totalMs,
    })
    .eq("id", sessionId);

  if (error) throw error;
};

/**
 * Fetch quiz session results
 */
export const fetchQuizResults = async (sessionId: string) => {
  const { data: session, error: sessionError } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError) throw sessionError;

  const { data: attempts, error: attemptsError } = await supabase
    .from("attempts")
    .select("*, items(*)")
    .eq("session_id", sessionId);

  if (attemptsError) throw attemptsError;

  return { session, attempts };
};

/**
 * Fetch the authenticated user's profile details
 */
export const fetchProfile = async (): Promise<ProfileResponse> => {
  const { data, error } = await supabase.functions.invoke<ProfileResponse>("get-profile", {
    method: "GET",
  });

  if (error) throw error;
  if (!data) throw new Error("No profile data returned");

  if (!Array.isArray(data.folders)) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {
      const { data: fallbackFolders, error: fallbackError } = await supabase
        .from("folders")
        .select("id, owner_id, name, created_at, updated_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true })
        .returns<Database["public"]["Tables"]["folders"]["Row"][]>();

      if (!fallbackError && fallbackFolders) {
        data.folders = fallbackFolders.map((folder) => ({
          id: folder.id,
          ownerId: folder.owner_id,
          name: folder.name,
          createdAt: folder.created_at,
          updatedAt: folder.updated_at,
        }));
      } else {
        data.folders = [];
      }
    } else {
      data.folders = [];
    }
  }

  if (!Array.isArray(data.documents)) {
    data.documents = [];
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (userId) {
    const { data: latestDocuments, error: latestDocumentsError } = await supabase
      .from("documents")
      .select(
        "id, owner_id, title, description, source_type, storage_path, status, page_count, content_sha, metadata, folder_id, created_at, updated_at",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .returns<Database["public"]["Tables"]["documents"]["Row"][]>();

    if (!latestDocumentsError && latestDocuments) {
      data.documents = latestDocuments.map((doc) => ({
        id: doc.id,
        ownerId: doc.owner_id,
        title: doc.title,
        description: doc.description,
        sourceType: doc.source_type,
        storagePath: doc.storage_path,
        status: doc.status,
        pageCount: doc.page_count,
        contentSha: doc.content_sha,
        metadata: doc.metadata as Record<string, unknown>,
        folderId: doc.folder_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }));
    }

  const { data: latestStudySets, error: latestStudySetsError } = await supabase
      .from("study_sets")
      .select(
        "id, owner_id, title, created_at, source_type, source_url, text, topics, config, source_document_id, folder_id, label_text, label_color",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .returns<Database["public"]["Tables"]["study_sets"]["Row"][]>();

    if (!latestStudySetsError && latestStudySets) {
      data.studySets = latestStudySets.map((set) => ({
        id: set.id,
        ownerId: set.owner_id,
        title: set.title,
        createdAt: set.created_at,
        sourceType: set.source_type,
        sourceUrl: set.source_url,
        text: set.text,
        topics: set.topics as string[] | null,
        config: (set.config ?? {}) as Record<string, unknown>,
        sourceDocumentId: set.source_document_id,
        folderId: set.folder_id,
        labelText: set.label_text,
        labelColor: set.label_color,
      }));
    }
  }

  const role = data.profile?.role ?? "user";
  const capabilities: ProfileCapabilities = data.capabilities ?? {
    role,
    canUseStudyModes: role !== "guest",
    quotas: role === "guest" ? { documents: 2, studySets: 2 } : null,
  };

  return {
    profile: data.profile,
    documents: data.documents,
    studySets: data.studySets,
    folders: data.folders,
    capabilities,
  };
};

export const createFolder = async (name: string): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("folders")
    .insert({
      name,
      owner_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throw error;
  return data.id;
};

export const renameFolder = async (folderId: string, name: string): Promise<void> => {
  const { error } = await supabase
    .from("folders")
    .update({ name })
    .eq("id", folderId);

  if (error) throw error;
};

export const clearFolderAssignments = async (folderId: string): Promise<void> => {
  const { error } = await supabase
    .from("documents")
    .update({ folder_id: null })
    .eq("folder_id", folderId);

  if (error) throw error;
};

export const deleteFolder = async (folderId: string): Promise<void> => {
  const { error } = await supabase
    .from("folders")
    .delete()
    .eq("id", folderId);

  if (error) throw error;
};

export const moveDocumentToFolder = async (documentId: string, folderId: string | null): Promise<void> => {
  const { error } = await supabase
    .from("documents")
    .update({ folder_id: folderId })
    .eq("id", documentId);

  if (error) throw error;
};

export const renameDocument = async (documentId: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from("documents")
    .update({ title })
    .eq("id", documentId);

  if (error) throw error;
};

export const updateStudySet = async (
  studySetId: string,
  updates: {
    title?: string;
    folderId?: string | null;
    labelText?: string | null;
    labelColor?: string | null;
  },
): Promise<void> => {
  const payload: Record<string, unknown> = {};

  if (typeof updates.title !== "undefined") payload.title = updates.title;
  if (typeof updates.folderId !== "undefined") payload.folder_id = updates.folderId;
  if (typeof updates.labelText !== "undefined") payload.label_text = updates.labelText;
  if (typeof updates.labelColor !== "undefined") payload.label_color = updates.labelColor;

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("study_sets")
    .update(payload)
    .eq("id", studySetId);

  if (error) throw error;
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) throw error;
};

export const updateProfile = async (updates: {
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const payload: Record<string, unknown> = {};

  if (typeof updates.username !== "undefined") {
    payload.username = updates.username;
  }

  if (typeof updates.displayName !== "undefined") {
    payload.display_name = updates.displayName;
  }

  if (typeof updates.avatarUrl !== "undefined") {
    payload.avatar_url = updates.avatarUrl;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) throw error;
};
