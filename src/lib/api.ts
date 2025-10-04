import { supabase } from "@/integrations/supabase/client";

export interface ParseResponse {
  text: string;
  topics: string;
  approxTokens: number;
}

export interface StudySet {
  id: string;
  title: string;
  text: string;
  topics: string[];
  config: {
    mcqCount: number;
    difficulty: string;
    topics?: string[];
  };
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
  createdAt: string;
  updatedAt: string;
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
}

export interface ProfileResponse {
  profile: UserProfile;
  documents: ProfileDocument[];
  studySets: ProfileStudySet[];
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
  content: string;
}): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await (supabase as any)
    .from("documents")
    .insert({
      title: params.title,
      source_type: params.sourceType,
      source_url: params.sourceUrl,
      owner_id: user.id,
      status: "processed",
      metadata: { content: params.content },
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

/**
 * Create a new study set
 */
export const createStudySet = async (params: {
  title: string;
  text: string;
  topics: string[];
  config: { mcqCount: number; difficulty: string; topics?: string[] };
  sourceType: "pdf" | "text" | "url";
  sourceUrl?: string;
  documentId?: string;
}): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await (supabase as any)
    .from("study_sets")
    .insert({
      title: params.title,
      text: params.text,
      topics: params.topics,
      config: params.config,
      source_type: params.sourceType,
      source_url: params.sourceUrl ?? null,
      source_document_id: params.documentId ?? null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw error;
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

  return data;
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
