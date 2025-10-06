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

interface KeyPointPayload {
  id: string;
  label: string;
  summary: string;
  evidence: string;
  importance: number;
}

interface EvaluateRequestKeyPoint {
  id?: string;
  label?: string;
  summary: string;
  evidence?: string;
}

type SummarizeAction = "key-points" | "example-summary" | "evaluate-summary";

type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  source_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

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

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeContent = (content: string) => {
  const lines = content
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const normalized = lines.join("\n");
  if (normalized.length > 16000) {
    return normalized.slice(0, 16000);
  }
  return normalized;
};

const computeWordTarget = (content: string) => {
  const words = content.split(/\s+/).filter(Boolean);
  const count = words.length;
  if (count === 0) return 150;
  const estimate = Math.round(count * 0.18);
  return Math.max(80, Math.min(220, estimate));
};

const extractJson = (text: string) => {
  const trimmed = text.trim();

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = candidate.slice(firstBrace, lastBrace + 1);
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
    temperature: 0.4,
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
    console.error("AI request failed", res.status, detail.slice(0, 300));
    throw new Error("AI generation failed");
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response missing content");
  }

  return content;
};

const handleKeyPoints = async (
  lovableApiKey: string,
  docTitle: string,
  content: string,
  wordTarget: number,
) => {
  const systemPrompt = `You help students study by extracting essential ideas from study material. Always respond with strict JSON.`;

  const userPrompt = `Document title: ${docTitle}\nTarget summary length: ${wordTarget} words or less.\n\nExtract the 3 to 6 most essential, non-overlapping key points from the document below. Each key point should summarise a distinct idea or relationship. Provide a short evidence excerpt where possible (under 25 words).\n\nReturn JSON with this exact schema:\n{\n  "keyPoints": [\n    {\n      "id": "KP1",\n      "label": "Short label",\n      "summary": "Plain-language explanation",\n      "evidence": "Quoted phrase or reference",\n      "importance": 0.0 to 1.0\n    }\n  ]\n}\n\nDocument:\n"""\n${content}\n"""`;

  const response = await callModel(lovableApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(response) as { keyPoints?: KeyPointPayload[] };

  if (!parsed?.keyPoints || !Array.isArray(parsed.keyPoints)) {
    throw new Error("AI did not return key points");
  }

  const keyPoints = parsed.keyPoints
    .map((kp, index) => ({
      id: kp.id?.trim() || `KP${index + 1}`,
      label: kp.label?.trim() || `Key idea ${index + 1}`,
      summary: kp.summary?.trim() || "",
      evidence: kp.evidence?.trim() || "",
      importance: typeof kp.importance === "number" ? Math.min(Math.max(kp.importance, 0), 1) : 0.5,
    }))
    .filter((kp) => kp.summary.length > 0);

  if (keyPoints.length === 0) {
    throw new Error("No usable key points extracted");
  }

  return { keyPoints, wordTarget };
};

const handleExampleSummary = async (
  lovableApiKey: string,
  docTitle: string,
  content: string,
  wordTarget: number,
) => {
  const systemPrompt = `You write concise study summaries that model great student writing. Always return strict JSON.`;

  const userPrompt = `Document title: ${docTitle}\nWrite a model study summary in the student's own words. Use an approachable tone and respect the target length of ${wordTarget} words or fewer. Avoid bullet lists.\n\nReturn JSON as {"summary": "...", "wordCount": number}.\n\nDocument contents:\n"""\n${content}\n"""`;

  const response = await callModel(lovableApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(response) as { summary?: string; wordCount?: number };

  if (!parsed?.summary) {
    throw new Error("AI did not return a summary");
  }

  const summaryWords = parsed.summary.split(/\s+/).filter(Boolean);
  const wordCount = summaryWords.length > 0 ? summaryWords.length : parsed.wordCount ?? 0;

  return {
    summary: parsed.summary.trim(),
    wordCount,
  };
};

const handleEvaluate = async (
  lovableApiKey: string,
  docTitle: string,
  content: string,
  wordTarget: number,
  userSummary: string,
  keyPoints: EvaluateRequestKeyPoint[],
) => {
  if (!userSummary.trim()) {
    throw new Error("User summary is empty");
  }

  const formattedKeyPoints = keyPoints
    .map((kp, index) => `${kp.id ?? `KP${index + 1}`}: ${kp.summary}`)
    .join("\n");

  const systemPrompt = `You evaluate students' summaries. Compare the student's writing against the provided gold key points. Respond only with JSON.`;

  const userPrompt = `Document title: ${docTitle}\nTarget summary length: ${wordTarget} words or fewer.\n\nGold key points:\n${formattedKeyPoints}\n\nStudent summary:\n"""\n${userSummary.trim()}\n"""\n\nAnalyse coverage (key ideas present), conciseness, and originality (degree of paraphrasing).\nReturn JSON as:\n{\n  "coverage": { "score": 0-1, "covered": number, "total": number, "missed": [ { "id": string, "label": string, "reason": string } ] },\n  "conciseness": { "score": 0-1, "comment": string },\n  "originality": { "score": 0-1, "comment": string },\n  "strengths": [string],\n  "improvements": [string],\n  "rewriteHints": [string]\n}`;

  const response = await callModel(lovableApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(response) as {
    coverage?: { score?: number; covered?: number; total?: number; missed?: { id?: string; label?: string; reason?: string }[] };
    conciseness?: { score?: number; comment?: string };
    originality?: { score?: number; comment?: string };
    strengths?: string[];
    improvements?: string[];
    rewriteHints?: string[];
  };

  if (!parsed?.coverage) {
    throw new Error("AI evaluation was incomplete");
  }

  const coverage = {
    score: clamp(parsed.coverage.score ?? 0),
    covered: parsed.coverage.covered ?? 0,
    total: parsed.coverage.total ?? keyPoints.length,
    missed: Array.isArray(parsed.coverage.missed)
      ? parsed.coverage.missed.map((item, index) => ({
          id: item.id?.trim() || `KP${index + 1}`,
          label: item.label?.trim() || "Uncovered idea",
          reason: item.reason?.trim() || "Consider mentioning this idea explicitly.",
        }))
      : [],
  };

  const conciseness = {
    score: clamp(parsed.conciseness?.score ?? 0),
    comment: parsed.conciseness?.comment?.trim() || "",
  };

  const originality = {
    score: clamp(parsed.originality?.score ?? 0),
    comment: parsed.originality?.comment?.trim() || "",
  };

  return {
    coverage,
    conciseness,
    originality,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map((item) => item.trim()).filter(Boolean) : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map((item) => item.trim()).filter(Boolean) : [],
    rewriteHints: Array.isArray(parsed.rewriteHints) ? parsed.rewriteHints.map((item) => item.trim()).filter(Boolean) : [],
  };
};

const clamp = (value: number) => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 100) / 100;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return json(401, { error: "Unauthorized" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (_) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { action, documentId, userSummary, keyPoints } = body ?? {};

  if (!documentId || typeof documentId !== "string") {
    return json(400, { error: "documentId is required" });
  }

  const actionValue = action as SummarizeAction;
  if (!actionValue || !["key-points", "example-summary", "evaluate-summary"].includes(actionValue)) {
    return json(400, { error: "Unsupported action" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !lovableApiKey) {
      console.error("Missing required environment variables");
      return json(500, { error: "Server not configured" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

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

    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("id, owner_id, title, source_type, metadata, created_at")
      .eq("id", documentId)
      .eq("owner_id", user.id)
      .maybeSingle<DocumentRow>();

    if (fetchError) {
      console.error("Document fetch error", fetchError);
      return json(500, { error: "Failed to load document" });
    }

    if (!document) {
      return json(404, { error: "Document not found" });
    }

    const content = document.metadata?.["content"];
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return json(400, { error: "Document has no stored content" });
    }

    const normalized = normalizeContent(content);
    const wordTarget = computeWordTarget(normalized);

    if (actionValue === "key-points") {
      const result = await handleKeyPoints(lovableApiKey, document.title, normalized, wordTarget);
      return json(200, { data: result });
    }

    if (actionValue === "example-summary") {
      const result = await handleExampleSummary(lovableApiKey, document.title, normalized, wordTarget);
      return json(200, { data: { ...result, wordTarget } });
    }

    if (actionValue === "evaluate-summary") {
      if (!Array.isArray(keyPoints) || keyPoints.length === 0) {
        return json(400, { error: "keyPoints are required for evaluation" });
      }

      const result = await handleEvaluate(
        lovableApiKey,
        document.title,
        normalized,
        wordTarget,
        String(userSummary ?? ""),
        keyPoints as EvaluateRequestKeyPoint[],
      );
      return json(200, { data: { ...result, wordTarget } });
    }

    return json(400, { error: "Unsupported action" });
  } catch (error) {
    console.error("Summarize function error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
