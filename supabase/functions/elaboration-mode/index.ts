// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_ID = "deepseek/deepseek-chat-v3.1:free";

type Role = "guest" | "user" | "admin";

interface DocumentRow {
  id: string;
  owner_id: string;
  title: string;
  source_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const getRole = async (
  client: ReturnType<typeof createClient>,
  userId: string,
): Promise<Role> => {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ role: Role }>();

  if (error) {
    console.error("Role lookup failed", error);
    return "user";
  }

  return (data?.role ?? "user") as Role;
};

interface Chunk {
  id: string;
  label: string;
  text: string;
  excerpt: string;
}

interface GeneratedQuestionRaw {
  id?: string;
  prompt?: string;
  difficulty?: string;
  modelAnswer?: string;
  focus?: string;
  chunkRefs?: string[];
}

interface ElaborationAnchor {
  chunkId: string;
  label: string;
  excerpt: string;
  text: string;
}

interface ElaborationQuestion {
  id: string;
  prompt: string;
  difficulty: "standard" | "advanced";
  modelAnswer: string;
  focus?: string;
  anchors: ElaborationAnchor[];
}

interface EvaluationScores {
  coverage: { value: number; explanation: string };
  causal: { value: number; explanation: string };
  connection: { value: number; explanation: string };
}

interface EvaluationHighlights {
  correctIdeas: string[];
  missingLinks: string[];
  suggestions: string[];
}

interface ElaborationEvaluation {
  scores: EvaluationScores;
  highlights: EvaluationHighlights;
  modelAnswer: string;
  followUp?: string;
}

interface SummarizeInput {
  question: string;
  highlights: EvaluationHighlights;
  scores: EvaluationScores;
}

interface SessionSummary {
  conceptsExplainedWell: string[];
  conceptsNeedingElaboration: string[];
  studyTips: string[];
}

interface GenerateOptions {
  questionCount?: number;
  difficulty?: string;
}

interface GeneratePayload extends GenerateOptions {
  documentId: string;
}

interface ElaborationActionPayload {
  action: ElaborationAction;
  documentId?: string;
  question?: ElaborationQuestion;
  userAnswer?: string;
  documentTitle?: string;
  evaluations?: SummarizeInput[];
  questionCount?: number;
  difficulty?: string;
}

type ElaborationAction = "generate-questions" | "evaluate-answer" | "summarize-session";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeContent = (content: string) => {
  const cleaned = content
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  if (cleaned.length > 18000) {
    return cleaned.slice(0, 18000);
  }

  return cleaned;
};

const createChunks = (content: string): Chunk[] => {
  const words = content.split(/\s+/).filter(Boolean);
  const chunkSize = 220;
  const overlap = 40;
  const maxChunks = 12;
  const chunks: Chunk[] = [];

  for (let index = 0; index < words.length && chunks.length < maxChunks; index += chunkSize - overlap) {
    const slice = words.slice(index, index + chunkSize);
    if (slice.length === 0) break;

    const text = slice.join(" ").trim();
    if (!text) continue;

    const excerpt = text.length > 260 ? `${text.slice(0, 257)}…` : text;
    chunks.push({
      id: `CH${chunks.length + 1}`,
      label: `Chunk ${chunks.length + 1}`,
      text,
      excerpt,
    });
  }

  return chunks;
};

const extractJson = (input: string) => {
  const trimmed = input.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeBlock ? codeBlock[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last > first) {
      const sliced = candidate.slice(first, last + 1);
      return JSON.parse(sliced);
    }
    throw new Error("Unable to parse JSON from model response");
  }
};

const callModel = async (lovableApiKey: string, systemPrompt: string, userPrompt: string) => {
  const payload = {
    model: MODEL_ID,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("AI request failed", res.status, detail.slice(0, 200));
    throw new Error("AI generation failed");
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response missing content");
  }

  return content;
};

const clampScore = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
};

const fetchDocument = async (
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  userId: string,
) => {
  const { data, error } = await (supabase as any)
    .from("documents")
    .select("id, owner_id, title, source_type, metadata, created_at")
    .eq("id", documentId)
    .eq("owner_id", userId)
    .maybeSingle<DocumentRow>();

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
    content,
    createdAt: data.created_at,
  };
};

const clampQuestionCount = (value: unknown) => {
  if (typeof value !== "number") return 10;
  if (Number.isNaN(value)) return 10;
  const rounded = Math.round(value);
  if (rounded < 4) return 4;
  if (rounded > 18) return 18;
  return rounded;
};

const normalizeDifficulty = (value: unknown): "mixed" | "core" | "advanced" => {
  if (typeof value !== "string") return "mixed";
  const normalized = value.trim().toLowerCase();
  if (normalized === "core") return "core";
  if (normalized === "advanced") return "advanced";
  return "mixed";
};

const handleGenerateQuestions = async (
  params: {
    lovableApiKey: string;
    supabase: ReturnType<typeof createClient>;
    userId: string;
    payload: GeneratePayload;
  },
) => {
  const { lovableApiKey, supabase, payload, userId } = params;
  const { documentId } = payload;
  const questionCount = clampQuestionCount(payload.questionCount ?? 10);
  const difficultyPreference = normalizeDifficulty(payload.difficulty);
  const document = await fetchDocument(supabase, documentId, userId);
  const normalized = normalizeContent(document.content);
  const chunks = createChunks(normalized);

  if (!chunks.length) {
    throw new Error("Document content is too short to generate questions");
  }

  const chunkPrompt = chunks
    .map((chunk) => `Chunk ${chunk.id} (${chunk.label}):\n"""\n${chunk.text}\n"""`)
    .join("\n\n");

  const systemPrompt = `You are an expert learning scientist designing elaborative interrogation prompts. Use Bloom-style why/how/compare stems and return strict JSON.`;

  const difficultyInstructions = (() => {
    if (difficultyPreference === "core") {
      return "Make the prompts focus on foundational causal links and label each one as \"standard\" difficulty.";
    }
    if (difficultyPreference === "advanced") {
      return "Make every prompt multi-step, comparative, or hypothetical and label each one as \"advanced\" difficulty.";
    }
    return "Blend foundational and stretch prompts. Label simpler prompts as \"standard\" and complex prompts as \"advanced\".";
  })();

  const userPrompt = `Document title: ${document.title}\n\nStudy material has been chunked. Using the chunks below, produce exactly ${questionCount} elaborative questions.\nEach question must:\n- Use a why/how/compare/what-if stem.\n- Anchor to 1 or 2 chunk IDs from the list.\n- Stay specific to the text.\n- Provide a compact model answer (3-4 sentences) that uses linking phrases like "because", "so", "therefore".\n- ${difficultyInstructions}\n\nChunked material:\n${chunkPrompt}\n\nReturn JSON exactly as:\n{\n  "questions": [\n    {\n      "id": "ELQ1",\n      "prompt": "Why does ...?",\n      "difficulty": "standard",\n      "modelAnswer": "...",\n      "focus": "optional short descriptor",\n      "chunkRefs": ["CH1", "CH2"]\n    }\n  ]\n}\n\nDo not include any additional text.`;

  const response = await callModel(lovableApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(response) as { questions?: GeneratedQuestionRaw[] };

  if (!parsed?.questions || !Array.isArray(parsed.questions)) {
    throw new Error("AI did not return questions");
  }

  const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));

  const questions: ElaborationQuestion[] = parsed.questions
    .filter((item) => typeof item?.prompt === "string" && item.prompt.trim().length > 0)
    .map((item, index) => {
      const id = (item.id && typeof item.id === "string" && item.id.trim().length > 0)
        ? item.id.trim()
        : `ELQ${index + 1}`;

      const difficulty = item.difficulty === "advanced" ? "advanced" : "standard";
      const modelAnswer = (item.modelAnswer ?? "").trim();
      const focus = item.focus?.trim() ?? undefined;
      const refs = Array.isArray(item.chunkRefs) ? item.chunkRefs.slice(0, 2) : [];

      const anchors = refs
        .map((ref) => chunkMap.get(ref))
        .filter((chunk): chunk is Chunk => Boolean(chunk))
        .map((chunk) => ({
          chunkId: chunk.id,
          label: chunk.label,
          excerpt: chunk.excerpt,
          text: chunk.text,
        }));

      if (!anchors.length) {
        const fallback = chunks[index % chunks.length];
        anchors.push({
          chunkId: fallback.id,
          label: fallback.label,
          excerpt: fallback.excerpt,
          text: fallback.text,
        });
      }

      return {
        id,
        prompt: item.prompt!.trim(),
        difficulty,
        modelAnswer: modelAnswer.length ? modelAnswer : "",
        focus,
        anchors,
      } as ElaborationQuestion;
    })
    .slice(0, questionCount);

  if (!questions.length) {
    throw new Error("No usable questions generated");
  }

  return {
    document: {
      id: document.id,
      title: document.title,
    },
    questions,
    config: {
      questionCount,
      difficulty: difficultyPreference,
    },
  };
};

const handleEvaluateAnswer = async (
  params: {
    lovableApiKey: string;
    question: ElaborationQuestion;
    userAnswer: string;
  },
) => {
  const { lovableApiKey, question, userAnswer } = params;

  const context = question.anchors
    .map((anchor) => `Chunk ${anchor.chunkId} (${anchor.label}):\n${anchor.text}`)
    .join("\n\n");

  const trimmedAnswer = (userAnswer ?? "").trim();

  const systemPrompt = `You are an adaptive tutor evaluating how well a student elaborates on study material. Score their response and highlight strengths and gaps. Always return strict JSON.`;

  const userPrompt = `Question prompt:\n${question.prompt}\n\nReference model answer:\n${question.modelAnswer}\n\nRelevant source excerpts:\n${context}\n\nStudent response:\n${trimmedAnswer || "(no response provided)"}\n\nEvaluate the student on three dimensions:\n1. Coverage of key ideas from the model answer.\n2. Causal/why reasoning quality.\n3. Connection quality - linking ideas back to source concepts.\n\nReturn JSON exactly as:\n{\n  "scores": {\n    "coverage": { "value": 0-1, "explanation": "..." },\n    "causal": { "value": 0-1, "explanation": "..." },\n    "connection": { "value": 0-1, "explanation": "..." }\n  },\n  "highlights": {\n    "correctIdeas": ["idea"],\n    "missingLinks": ["gap"],\n    "suggestions": ["actionable coaching tip"]\n  },\n  "modelAnswer": "Improved 3-4 sentence elaborated answer using linking phrases.",\n  "followUp": "One short tip to improve next time."\n}\n\nEnsure lists stay concise (max 4 items each). Use British English.`;

  const response = await callModel(lovableApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(response) as Partial<ElaborationEvaluation>;

  if (!parsed?.scores || !parsed.highlights) {
    throw new Error("AI did not return evaluation");
  }

  const scores: EvaluationScores = {
    coverage: {
      value: clampScore(parsed.scores?.coverage?.value),
      explanation: parsed.scores?.coverage?.explanation?.trim() ?? "",
    },
    causal: {
      value: clampScore(parsed.scores?.causal?.value),
      explanation: parsed.scores?.causal?.explanation?.trim() ?? "",
    },
    connection: {
      value: clampScore(parsed.scores?.connection?.value),
      explanation: parsed.scores?.connection?.explanation?.trim() ?? "",
    },
  };

  const highlights: EvaluationHighlights = {
    correctIdeas: Array.isArray(parsed.highlights?.correctIdeas)
      ? parsed.highlights!.correctIdeas.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 4)
      : [],
    missingLinks: Array.isArray(parsed.highlights?.missingLinks)
      ? parsed.highlights!.missingLinks.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 4)
      : [],
    suggestions: Array.isArray(parsed.highlights?.suggestions)
      ? parsed.highlights!.suggestions.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 4)
      : [],
  };

  const modelAnswer = parsed.modelAnswer?.trim()?.length ? parsed.modelAnswer.trim() : question.modelAnswer;
  const followUp = parsed.followUp?.trim()?.length ? parsed.followUp.trim() : undefined;

  return {
    scores,
    highlights,
    modelAnswer,
    followUp,
  } satisfies ElaborationEvaluation;
};

const handleSessionSummary = async (
  params: {
    lovableApiKey: string;
    documentTitle: string;
    evaluations: SummarizeInput[];
  },
) => {
  const { lovableApiKey, documentTitle, evaluations } = params;

  if (!evaluations.length) {
    return {
      conceptsExplainedWell: [],
      conceptsNeedingElaboration: [],
      studyTips: [],
    } satisfies SessionSummary;
  }

  const formatted = evaluations
    .map((item, index) => `Q${index + 1}: ${item.question}\n  Coverage: ${item.scores.coverage.value}\n  Causal: ${item.scores.causal.value}\n  Connection: ${item.scores.connection.value}\n  Correct ideas: ${item.highlights.correctIdeas.join("; ") || "-"}\n  Missing links: ${item.highlights.missingLinks.join("; ") || "-"}\n  Suggestions: ${item.highlights.suggestions.join("; ") || "-"}`)
    .join("\n\n");

  const systemPrompt = `You are a study coach summarising performance across elaboration prompts. Produce helpful recap lists. Always return JSON.`;

  const userPrompt = `Document title: ${documentTitle}\n\nEvaluation log:\n${formatted}\n\nCreate a concise recap with:\n- conceptsExplainedWell: unique ideas the student covered well;\n- conceptsNeedingElaboration: gaps or links to revisit;\n- studyTips: up to 3 actionable tips for next steps.\n\nReturn JSON as {"conceptsExplainedWell": [...], "conceptsNeedingElaboration": [...], "studyTips": [...]} in British English.`;

  const response = await callModel(lovableApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(response) as Partial<SessionSummary>;

  const conceptsExplainedWell = Array.isArray(parsed.conceptsExplainedWell)
    ? parsed.conceptsExplainedWell.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 6)
    : [];

  const conceptsNeedingElaboration = Array.isArray(parsed.conceptsNeedingElaboration)
    ? parsed.conceptsNeedingElaboration.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 6)
    : [];

  const studyTips = Array.isArray(parsed.studyTips)
    ? parsed.studyTips.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 3)
    : [];

  return {
    conceptsExplainedWell,
    conceptsNeedingElaboration,
    studyTips,
  } satisfies SessionSummary;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!supabaseUrl) return json(500, { error: "Missing SUPABASE_URL" });
  if (!supabaseKey) return json(500, { error: "Missing SUPABASE_SERVICE_ROLE_KEY" });
  if (!lovableApiKey) return json(500, { error: "Missing LOVABLE_API_KEY" });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return json(401, { error: "Unauthorized" });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return json(401, { error: "Unauthorized" });
  }

  const role = await getRole(supabase, user.id);
  if (role === "guest") {
    return json(403, {
      error: "Guest accounts cannot access study modes",
      reason: "upgrade_required",
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_) {
    return json(400, { error: "Invalid JSON body" });
  }

  const action = payload?.action as ElaborationAction | undefined;
  if (!action) {
    return json(400, { error: "action is required" });
  }

  try {
    if (action === "generate-questions") {
      const documentId = payload?.documentId as string | undefined;
      if (!documentId) {
        return json(400, { error: "documentId is required" });
      }

      const data = await handleGenerateQuestions({
        lovableApiKey,
        supabase,
        userId: user.id,
        payload: {
          documentId,
          questionCount: typeof payload?.questionCount === "number" ? payload.questionCount : undefined,
          difficulty: typeof payload?.difficulty === "string" ? payload.difficulty : undefined,
        },
      });
      return json(200, { data });
    }

    if (action === "evaluate-answer") {
      const question = payload?.question as ElaborationQuestion | undefined;
      const userAnswer = payload?.userAnswer as string | undefined;

      if (!question || typeof question.prompt !== "string" || !Array.isArray(question.anchors)) {
        return json(400, { error: "question payload is invalid" });
      }

      const data = await handleEvaluateAnswer({ lovableApiKey, question, userAnswer: userAnswer ?? "" });
      return json(200, { data });
    }

    if (action === "summarize-session") {
      const documentTitle = payload?.documentTitle as string | undefined;
      const evaluations = payload?.evaluations as SummarizeInput[] | undefined;

      if (!documentTitle) {
        return json(400, { error: "documentTitle is required" });
      }

      if (!Array.isArray(evaluations)) {
        return json(400, { error: "evaluations must be an array" });
      }

      const data = await handleSessionSummary({ lovableApiKey, documentTitle, evaluations });
      return json(200, { data });
    }

    return json(400, { error: "Unknown action" });
  } catch (error) {
    console.error("Elaboration mode error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json(500, { error: message });
  }
});
