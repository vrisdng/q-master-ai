import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	"Access-Control-Max-Age": "86400",
};

const MODEL_ID = Deno.env.get("MODEL_ID");

type Role = "guest" | "user" | "admin";
type Intensity = "light" | "standard" | "intense";

type QuestionPlan = {
	mcq: number;
	fillInTheBlank: number;
	matching: number;
	essay: { count: number; wordCount: number };
	shortAnswer: { count: number; wordCount: number };
};

type TestStatus = "draft" | "ready" | "archived";
type RunStatus = "configured" | "in_progress" | "completed" | "cancelled";

interface TestRow {
	id: string;
	owner_id: string;
	title: string;
	description: string | null;
	intensity: Intensity;
	timer_enabled: boolean;
	question_plan: QuestionPlan;
	folder_ids: string[];
	document_ids: string[];
	status: TestStatus;
	config: {
		timerMode?: "countdown" | "none";
		timerMinutes?: number;
		[key: string]: unknown;
	};
	created_at: string;
	updated_at: string;
}

interface RunRow {
	id: string;
	test_id: string;
	owner_id: string;
	status: RunStatus;
	generated_exam: MockExamPayload | null;
	responses: MockExamResponse[] | null;
	evaluation: EvaluationPayload | null;
	summary: SummaryPayload | null;
	started_at: string | null;
	completed_at: string | null;
	created_at: string;
	updated_at: string;
}

interface MockExamOption {
	label: string;
	text: string;
}

type QuestionType =
	| "mcq"
	| "fill-in-the-blank"
	| "matching"
	| "essay"
	| "short-answer";

interface QuestionBase {
	id: string;
	type: QuestionType;
	prompt: string;
	intensity: Intensity;
	sources?: Array<{ excerpt: string; label?: string; referenceId?: string }>;
	referenceIds?: string[];
}

interface MockExamMCQQuestion extends QuestionBase {
	type: "mcq";
	options: MockExamOption[];
	answerKey: string;
	explanation: string;
}

interface MockExamFillQuestion extends QuestionBase {
	type: "fill-in-the-blank";
	answer: string;
	explanation: string;
}

interface MockExamMatchingQuestion extends QuestionBase {
	type: "matching";
	pairs: Array<{ prompt: string; answer: string }>;
	explanation: string;
}

interface MockExamEssayQuestion extends QuestionBase {
	type: "essay";
	targetWordCount: number;
	idealResponse: string;
	rubric: string[];
}

interface MockExamShortAnswerQuestion extends QuestionBase {
	type: "short-answer";
	targetWordCount: number;
	keyPoints: string[];
	idealResponse: string;
}

type MockExamQuestion =
	| MockExamMCQQuestion
	| MockExamFillQuestion
	| MockExamMatchingQuestion
	| MockExamEssayQuestion
	| MockExamShortAnswerQuestion;

interface MockExamPayload {
	examId: string;
	documentTitle: string;
	intensity: Intensity;
	timer: {
		enabled: boolean;
		suggestedMinutes: number;
	};
	questions: MockExamQuestion[];
}

interface MockExamResponse {
	questionId: string;
	response:
		| string
		| null
		| Array<{ prompt: string; answer: string }>
		| Record<string, unknown>;
}

interface QuestionScore {
	questionId: string;
	type: QuestionType;
	score: number;
	outOf: number;
	isCorrect: boolean | null;
	feedback: string;
	strengths: string[];
	improvements: string[];
	yourAnswer: string | null;
	correctAnswer: string | null;
}

interface EvaluationPayload {
	overallScore: number;
	details: QuestionScore[];
	highlights: {
		strengths: string[];
		weakAreas: string[];
		suggestions: string[];
	};
	breakdownByType: Array<{
		type: QuestionType;
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

interface SummaryPayload {
	overallScore: number;
	breakdownByType: EvaluationPayload["breakdownByType"];
	masteryHeatmap: EvaluationPayload["masteryHeatmap"];
}

type DocumentRow = {
	id: string;
	owner_id: string;
	title: string;
	metadata: Record<string, unknown> | null;
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});

const getSupabaseClient = () => {
	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("Missing Supabase environment variables");
	}

	return createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false },
	});
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

const ensureAccessToken = (req: Request) => {
	const authHeader = req.headers.get("Authorization") ?? "";
	const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
	return accessToken;
};

const normalizePath = (url: URL) => {
	const base = url.pathname.replace(/^\/v1-test/, "");
	return base || "/";
};

const sanitizeQuestions = (
	questions: unknown[],
	intensity: Intensity,
): MockExamQuestion[] => {
	const toRecord = (value: unknown): Record<string, unknown> | null =>
		typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

	return questions
		.map((item, index) => {
			const record = toRecord(item);
			if (!record) return null;

			const idValue = record.id;
			const id = typeof idValue === "string" && idValue.trim().length > 0 ? idValue.trim() : `Q${index + 1}`;

      const rawType = typeof record.type === "string" ? record.type : "";
      let type = normalizeQuestionType(rawType);
      const promptValue = record.prompt ?? record.question ?? record.text;
      const prompt = typeof promptValue === "string" ? promptValue.trim() : "";

			const rawSources = record.sources;
			const sources = Array.isArray(rawSources)
				? rawSources
						.map((source) => {
							const sourceRecord = toRecord(source);
							if (!sourceRecord) return null;
							const excerptRaw = sourceRecord.excerpt ?? sourceRecord.text ?? sourceRecord.content;
							const excerpt = typeof excerptRaw === "string" ? excerptRaw.trim() : "";
							const labelRaw = sourceRecord.label ?? sourceRecord.source ?? sourceRecord.title;
							const label = typeof labelRaw === "string" ? labelRaw.trim() : undefined;
							const referenceIdRaw = sourceRecord.referenceId ?? sourceRecord.id;
							const referenceId = typeof referenceIdRaw === "string" ? referenceIdRaw.trim() : undefined;
							return excerpt ? { excerpt, label, referenceId } : null;
						})
						.filter((entry): entry is { excerpt: string; label?: string; referenceId?: string } => Boolean(entry))
				: undefined;

      if (!type) {
        if (record.options ?? record.choices ?? record.answers) {
          type = "mcq";
        } else if (record.pairs ?? record.items ?? record.matching ?? record.links) {
          type = "matching";
        } else if (record.keyPoints ?? record.key_points ?? record.highlights) {
          type = "short-answer";
        } else if (record.targetWordCount ?? record.target_word_count ?? record.sample) {
          type = "essay";
        } else if (record.answer ?? record.solution ?? record.correct) {
          type = "fill-in-the-blank";
        }
      }

      if (!prompt || !type) return null;

			const base: QuestionBase = { id, type, prompt, intensity, sources };

			switch (type) {
				case "mcq": {
					const rawOptions = record.options ?? record.choices ?? record.answers;
					const options = Array.isArray(rawOptions)
						? rawOptions
								.map((option, optionIndex) => {
									const optionRecord = toRecord(option);
									if (!optionRecord) {
										if (typeof option === "string") {
											const { label, text } = parseOptionString(option, optionIndex);
											return label && text ? { label, text } : null;
										}
										return null;
									}

									const labelRaw = optionRecord.label ?? optionRecord.key ?? optionRecord.id ?? optionRecord.option;
									const label = typeof labelRaw === "string"
										? labelRaw.trim().slice(0, 1).toUpperCase()
										: String(labelRaw ?? "").trim().slice(0, 1).toUpperCase();

									const textRaw = optionRecord.text ?? optionRecord.value ?? optionRecord.answer ?? optionRecord.content;
									const text = typeof textRaw === "string"
										? textRaw.trim()
										: typeof textRaw === "number"
										? String(textRaw)
										: "";

									return label && text ? { label, text } : null;
								})
								.filter((entry): entry is MockExamOption => Boolean(entry))
						: [];

					const normalizedOptions = options.length === 0 && Array.isArray(rawOptions)
						? rawOptions
								.map((entry, idx) => {
									if (typeof entry === "string") {
										const { label, text } = parseOptionString(entry, idx);
										return label && text ? { label, text } : null;
									}
									return null;
								})
								.filter((entry): entry is MockExamOption => Boolean(entry))
						: options;

					const answerKeyRaw = record.answerKey ?? record.answer_key ?? record.correct ?? record.correct_option;
					const answerKey = typeof answerKeyRaw === "string"
						? answerKeyRaw.trim().slice(0, 1).toUpperCase()
						: typeof answerKeyRaw === "number"
						? String(answerKeyRaw).trim().slice(0, 1).toUpperCase()
						: "";

					const explanationRaw = record.explanation ?? record.rationale ?? record.solution ?? record.reason;
          const explanation = typeof explanationRaw === "string" && explanationRaw.trim().length > 0
            ? explanationRaw.trim()
            : "Review the material to understand why this answer is correct.";

          if (normalizedOptions.length < 2) return null;

					return {
						...base,
						type,
						options: normalizedOptions,
						answerKey: answerKey || normalizedOptions[0].label,
						explanation,
					};
				}
				case "fill-in-the-blank": {
					const answerRaw = record.answer ?? record.correct ?? record.solution ?? record.response;
					const explanationRaw = record.explanation ?? record.rationale ?? record.note ?? record.reason;
					const answer = typeof answerRaw === "string" ? answerRaw.trim() : "";
          const explanation = typeof explanationRaw === "string" && explanationRaw.trim().length > 0
            ? explanationRaw.trim()
            : "The correct phrase completes the sentence based on the source.";
          if (!answer) return null;

					return {
						...base,
						type,
						answer,
						explanation,
					};
				}
				case "matching": {
					const rawPairs = record.pairs ?? record.items ?? record.matching ?? record.links;
					const pairs = Array.isArray(rawPairs)
						? rawPairs
								.map((pair) => {
									const pairRecord = toRecord(pair);
									if (!pairRecord) return null;

									const promptRaw = pairRecord.prompt ?? pairRecord.left ?? pairRecord.term ?? pairRecord.question ?? pairRecord.a;
									const answerRaw = pairRecord.answer ?? pairRecord.right ?? pairRecord.definition ?? pairRecord.response ?? pairRecord.b;

									const promptText = typeof promptRaw === "string"
										? promptRaw.trim()
										: typeof promptRaw === "number"
										? String(promptRaw)
										: "";
									const answerText = typeof answerRaw === "string"
										? answerRaw.trim()
										: typeof answerRaw === "number"
										? String(answerRaw)
										: "";

									return promptText && answerText ? { prompt: promptText, answer: answerText } : null;
								})
								.filter((entry): entry is { prompt: string; answer: string } => Boolean(entry))
						: [];

					const explanationRaw = record.explanation ?? record.summary ?? record.note ?? record.reason;
          const explanation = typeof explanationRaw === "string" && explanationRaw.trim().length > 0
            ? explanationRaw.trim()
            : "Match each prompt with the corresponding concept from the text.";

          if (pairs.length === 0) return null;

					return {
						...base,
						type,
						pairs,
						explanation,
					};
				}
				case "essay": {
					const targetWordCount = Number(
						record.targetWordCount ?? record.target_word_count ?? record.wordCount ?? record.word_count ?? 0,
					);
					const idealResponseRaw = record.idealResponse ?? record.ideal_response ?? record.sample ?? record.answer ?? record.solution;
					const idealResponse = typeof idealResponseRaw === "string" ? idealResponseRaw.trim() : "";
					const rawRubric = record.rubric ?? record.criteria ?? record.checklist;
					const rubric = Array.isArray(rawRubric)
						? rawRubric
								.map((rule) => (typeof rule === "string" ? rule.trim() : String(rule ?? "").trim()))
								.filter((entry) => entry.length > 0)
						: [];

					if (!idealResponse || targetWordCount <= 0) return null;

					return {
						...base,
						type,
						targetWordCount,
						idealResponse,
						rubric: rubric.length > 0 ? rubric : ["Clarity", "Accuracy", "Depth"],
					} satisfies MockExamEssayQuestion;
				}
				case "short-answer": {
					const targetWordCount = Number(
						record.targetWordCount ?? record.target_word_count ?? record.wordCount ?? record.word_count ?? 0,
					);
					const rawKeyPoints = record.keyPoints ?? record.key_points ?? record.points ?? record.highlights ?? record.expectations;
					const keyPoints = Array.isArray(rawKeyPoints)
						? rawKeyPoints
								.map((point) => (typeof point === "string" ? point.trim() : String(point ?? "").trim()))
								.filter((entry) => entry.length > 0)
						: [];
					const idealResponseRaw = record.idealResponse ?? record.ideal_response ?? record.sample ?? record.answer ?? record.solution;
					const idealResponse = typeof idealResponseRaw === "string" ? idealResponseRaw.trim() : "";

					if (!idealResponse || targetWordCount <= 0) return null;

					return {
						...base,
						type,
						targetWordCount,
						keyPoints,
						idealResponse,
					} satisfies MockExamShortAnswerQuestion;
				}
				default:
					return null;
			}
		})
		.filter((question): question is MockExamQuestion => question !== null);
};


const normalizeQuestionType = (raw: string): QuestionType | null => {
	const value = raw.toLowerCase().trim();
	if (!value) return null;

	if (value.includes("multiple") || value === "mcq" || value === "choice" || value === "selection") {
		return "mcq";
	}
	if (value.includes("fill") || value.includes("blank") || value === "cloze") {
		return "fill-in-the-blank";
	}
	if (value.includes("match") || value.includes("pair") || value.includes("link")) {
		return "matching";
	}
	if (value.includes("essay") || value.includes("long")) {
		return "essay";
	}
	if (value.includes("short") || value.includes("free") || value.includes("brief")) {
		return "short-answer";
	}
	return null;
};

const parseOptionString = (option: string, index: number): { label: string; text: string } => {
	const trimmed = option.trim();
	const separator = trimmed.match(/^([A-Z]|[0-9]+)[\).:\-\s]+(.+)$/i);
	if (separator) {
		const label = separator[1].slice(0, 1).toUpperCase();
		const text = separator[2].trim();
		return { label, text };
	}
	const label = String.fromCharCode(65 + index);
	return { label, text: trimmed };
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

const callModel = async (
	apiKey: string,
	systemPrompt: string,
	userPrompt: string,
	temperature = 0.4,
) => {
	if (!MODEL_ID) {
		throw new Error("MODEL_ID environment variable is not set");
	}

	const payload = {
		model: MODEL_ID,
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature,
	};

	const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"X-Title": "q-master-ai-test-arena",
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

const scoreStringSimilarity = (expected: string, received: string) => {
	const normalize = (value: string) =>
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, " ")
			.trim();

	const a = normalize(expected);
	const b = normalize(received);

	if (!a || !b) return 0;
	if (a === b) return 1;

	const tokensA = new Set(a.split(" "));
	const tokensB = new Set(b.split(" "));

	let overlap = 0;
	tokensA.forEach((token) => {
		if (tokensB.has(token)) overlap += 1;
	});

	return overlap / Math.max(tokensA.size, tokensB.size);
};

const evaluateConstructedResponse = async (
	apiKey: string,
	question: MockExamEssayQuestion | MockExamShortAnswerQuestion,
	response: string,
) => {
	const systemPrompt =
		"You are an expert exam grader. Evaluate the student's answer using the rubric provided. Always respond with strict JSON.";

	const rubricSummary = question.type === "essay"
		? question.rubric.join("; ")
		: question.keyPoints.join("; ");

	const userPrompt = `Question:
${question.prompt}

Student response:
${response || "(no response provided)"}

Reference answer:
${question.idealResponse}

Evaluation rubric/key points:
${rubricSummary}

Return JSON with:
{
  "score": number between 0 and 1,
  "feedback": "short paragraph",
  "strengths": ["1-2 bullet strengths"],
  "improvements": ["1-2 bullet suggestions"]
}`;

	const raw = await callModel(apiKey, systemPrompt, userPrompt, 0.25);
	const parsed = extractJson(raw) as {
		score?: number;
		feedback?: string;
		strengths?: string[];
		improvements?: string[];
	};

	const clampedScore = typeof parsed.score === "number"
		? Math.max(0, Math.min(1, parsed.score))
		: 0;

	return {
		score: clampedScore,
		feedback: parsed.feedback?.trim() ||
			"Response evaluated against the provided rubric.",
		strengths: Array.isArray(parsed.strengths)
			? parsed.strengths
					.map((entry) => String(entry ?? "").trim())
					.filter((entry) => entry.length > 0)
			: [],
		improvements: Array.isArray(parsed.improvements)
			? parsed.improvements
					.map((entry) => String(entry ?? "").trim())
					.filter((entry) => entry.length > 0)
			: [],
	};
};

const summarizePerformance = async (
	apiKey: string,
	documentTitle: string,
	results: QuestionScore[],
	intensity: Intensity,
) => {
	const systemPrompt =
		"You turn exam grading data into motivational feedback. Always return strict JSON.";

	const summaryPayload = {
		documentTitle,
		intensity,
		results: results.map((result) => ({
			questionId: result.questionId,
			score: result.score,
			outOf: result.outOf,
			isCorrect: result.isCorrect,
			feedback: result.feedback,
			strengths: result.strengths,
			improvements: result.improvements,
		})),
	};

	try {
		const raw = await callModel(apiKey, systemPrompt, JSON.stringify(summaryPayload), 0.2);
		const parsed = extractJson(raw) as {
			strengths?: string[];
			weakAreas?: string[];
			suggestions?: string[];
		};

		return {
			strengths: Array.isArray(parsed.strengths)
				? parsed.strengths
						.map((entry) => String(entry ?? "").trim())
						.filter((entry) => entry.length > 0)
				: [],
			weakAreas: Array.isArray(parsed.weakAreas)
				? parsed.weakAreas
						.map((entry) => String(entry ?? "").trim())
						.filter((entry) => entry.length > 0)
				: [],
			suggestions: Array.isArray(parsed.suggestions)
				? parsed.suggestions
						.map((entry) => String(entry ?? "").trim())
						.filter((entry) => entry.length > 0)
				: [],
		};
	} catch (error) {
		console.error("Performance summary generation failed", error);
		return {
			strengths: [],
			weakAreas: [],
			suggestions: [
				"Review your notes and revisit areas that felt less comfortable.",
			],
		};
	}
};

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

const aggregateDocumentContent = async (
	client: ReturnType<typeof createClient>,
	ownerId: string,
	documentIds: string[],
	folderIds: string[],
) => {
	const uniqueDocumentIds = new Set<string>();
	documentIds.forEach((id) => uniqueDocumentIds.add(id));

	if (folderIds.length > 0) {
		const { data, error } = await client
			.from("documents")
			.select("id")
			.eq("owner_id", ownerId)
			.in("folder_id", folderIds);

		if (error) {
			throw error;
		}
		data?.forEach((doc) => uniqueDocumentIds.add(doc.id));
	}

	if (uniqueDocumentIds.size === 0) {
		throw new Error("No documents selected for this test");
	}

	const { data, error } = await client
		.from("documents")
		.select("id, owner_id, title, metadata")
		.eq("owner_id", ownerId)
		.in("id", Array.from(uniqueDocumentIds))
		.returns<DocumentRow[]>();

	if (error) {
		throw error;
	}

	if (!data || data.length === 0) {
		throw new Error("No documents available for this test configuration");
	}

	const combinedContent = data
		.map((doc) => {
			const content = doc.metadata?.["content"];
			return typeof content === "string" ? normalizeContent(content) : "";
		})
		.filter(Boolean)
		.join("\n\n---\n\n");

	if (combinedContent.length < 100) {
		throw new Error("Selected documents do not contain enough content");
	}

	const title = data.length === 1
		? data[0].title
		: `${data[0].title} (+${data.length - 1} more)`;

	return { combinedContent, title };
};

const countTotalQuestions = (plan: QuestionPlan) =>
	plan.mcq +
	plan.fillInTheBlank +
	plan.matching +
	plan.essay.count +
	plan.shortAnswer.count;

const estimatePlanMinutes = (plan: QuestionPlan) =>
	Math.max(
		10,
		Math.round(
			plan.mcq * 4 +
				plan.fillInTheBlank * 3 +
				plan.matching * 5 +
				plan.essay.count * 12 +
				plan.shortAnswer.count * 6,
		),
	);

const sanitizeTimerMinutes = (value: unknown, fallback: number) => {
	const numeric =
		typeof value === "number"
			? value
			: typeof value === "string"
			? Number(value)
			: NaN;

	if (!Number.isFinite(numeric)) {
		return Math.max(1, Math.round(fallback));
	}

	return Math.max(1, Math.round(numeric));
};

const resolveTimerMinutes = (test: TestRow) =>
	sanitizeTimerMinutes(
		test.config?.timerMinutes,
		estimatePlanMinutes(test.question_plan),
	);

const composeTestConfig = (
	previous: TestRow["config"] | null | undefined,
	timerEnabled: boolean,
	timerMinutes: number,
) => ({
	...(previous ?? {}),
	timerMode: timerEnabled ? "countdown" : "none",
	timerMinutes,
});

const buildRequirementSummary = (plan: QuestionPlan) => {
	const entries: string[] = [];
	if (plan.mcq > 0) entries.push(`${plan.mcq} MCQs with explanations`);
	if (plan.fillInTheBlank > 0) entries.push(`${plan.fillInTheBlank} fill-in-the-blank prompts`);
	if (plan.matching > 0) entries.push(`${plan.matching} matching sets`);
	if (plan.essay.count > 0) entries.push(`${plan.essay.count} essay question(s) at ~${plan.essay.wordCount} words`);
	if (plan.shortAnswer.count > 0) entries.push(`${plan.shortAnswer.count} short-answer question(s) at ~${plan.shortAnswer.wordCount} words`);
	return entries;
};

const generateExam = async (
	lovableApiKey: string,
	test: TestRow,
	content: { combinedContent: string; title: string },
) => {
	const requirementSummary = buildRequirementSummary(test.question_plan);

	const totalQuestions = countTotalQuestions(test.question_plan);
	const recommendedMinutes = estimatePlanMinutes(test.question_plan);
	const configuredMinutes = resolveTimerMinutes(test);

	const systemPrompt =
		"You are an instructional designer creating high-quality mock exams. Respond with strict JSON only.";

	const userPrompt = `You must create a mock exam based on the provided study material.

Document title: ${content.title}
Intensity: ${test.intensity}
Student experience level: ${
	test.intensity === "light"
		? "warming up—prioritise foundations and confidence building"
		: test.intensity === "standard"
		? "practised—mix recall with application and lightweight synthesis"
		: "advanced—push synthesis, nuance, and multi-step reasoning"
}

Requirements:
- ${requirementSummary.join("\n- ")}
- Include a "sources" array with short quotes or references for grounding each question.
- Ensure all data is grounded purely in the source material.

Return JSON as:
{
  "questions": [
    {
      "id": "Q1",
      "type": "mcq" | "fill-in-the-blank" | "matching" | "essay" | "short-answer",
      "prompt": "Student-facing prompt",
      "sources": [{"excerpt": "Quoted phrase", "label": "Optional label"}],
      // Additional properties follow per type requirements...
    }
  ]
}

Material:
"""
${content.combinedContent}
"""`;

	const raw = await callModel(lovableApiKey, systemPrompt, userPrompt, 0.45);
	const parsed = extractJson(raw) as { questions?: unknown[] };

	if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
		throw new Error("AI did not return questions");
	}

	const questions = sanitizeQuestions(parsed.questions, test.intensity);

	if (questions.length === 0) {
		throw new Error("Unable to construct valid questions");
	}

	if (questions.length !== totalQuestions) {
		console.warn(
			`Expected ${totalQuestions} questions but received ${questions.length}`,
		);
	}

	return {
		examId: crypto.randomUUID(),
		documentTitle: content.title,
		intensity: test.intensity,
		timer: {
			enabled: test.timer_enabled,
			suggestedMinutes: test.timer_enabled
				? configuredMinutes
				: Math.max(configuredMinutes, recommendedMinutes),
		},
		questions,
	};
};

const evaluateResponses = async (
	lovableApiKey: string,
	exam: MockExamPayload,
	responses: MockExamResponse[],
) => {
	const scores: QuestionScore[] = [];

	for (const question of exam.questions) {
		const responseEntry = responses.find((entry) =>
			entry.questionId === question.id
		);

		let result: QuestionScore;

		switch (question.type) {
			case "mcq": {
				const answer = String(responseEntry?.response ?? "").trim().toUpperCase();
				const isCorrect = answer === question.answerKey;
				result = {
					questionId: question.id,
					type: question.type,
					score: isCorrect ? 1 : 0,
					outOf: 1,
					isCorrect,
					feedback: isCorrect
						? "Correct choice."
						: `Correct answer was ${question.answerKey}. ${question.explanation}`,
					strengths: isCorrect ? ["Confident recall of key facts."] : [],
					improvements: isCorrect
						? []
						: ["Revisit this concept to reinforce precise recall."],
					yourAnswer: answer || null,
					correctAnswer: question.answerKey,
				};
				break;
			}
			case "fill-in-the-blank": {
				const answer = String(responseEntry?.response ?? "").trim();
				const similarity = answer
					? scoreStringSimilarity(question.answer, answer)
					: 0;
				const isCorrect = similarity >= 0.85;
				result = {
					questionId: question.id,
					type: question.type,
					score: similarity,
					outOf: 1,
					isCorrect,
					feedback: similarity >= 0.85
						? "Excellent recall."
						: similarity >= 0.4
						? `Partially correct. Target phrase: "${question.answer}".`
						: `Expected: "${question.answer}".`,
					strengths: similarity >= 0.85 ? ["Precise recall of terminology."] : [],
					improvements: similarity >= 0.85
						? []
						: ["Practice recalling the exact phrasing used in the notes."],
					yourAnswer: answer || null,
					correctAnswer: question.answer,
				};
				break;
			}
			case "matching": {
				const selections = Array.isArray(responseEntry?.response)
					? responseEntry?.response as Array<{ prompt: string; answer: string }>
					: [];

				let correctMatches = 0;
				question.pairs.forEach((pair) => {
					const selected = selections.find((entry) =>
						entry.prompt === pair.prompt
					);
					if (
						selected &&
						scoreStringSimilarity(pair.answer, selected.answer) > 0.85
					) {
						correctMatches += 1;
					}
				});

				const ratio = question.pairs.length > 0
					? correctMatches / question.pairs.length
					: 0;

				result = {
					questionId: question.id,
					type: question.type,
					score: ratio,
					outOf: 1,
					isCorrect: ratio === 1 ? true : ratio === 0 ? false : null,
					feedback: ratio === 1
						? "Perfect matching."
						: `Matched ${correctMatches} of ${question.pairs.length}.`,
					strengths: ratio === 1 ? ["Strong concept linking."] : [],
					improvements: ratio === 1
						? []
						: ["Review how each term connects to its definition or example."],
					yourAnswer: selections.map((entry) => `${entry.prompt} → ${entry.answer}`).join("; ") || null,
					correctAnswer: question.pairs.map((pair) => `${pair.prompt} → ${pair.answer}`).join("; "),
				};
				break;
			}
			case "essay":
			case "short-answer": {
				const answer = String(responseEntry?.response ?? "");
				const { score, feedback, strengths, improvements } =
					await evaluateConstructedResponse(lovableApiKey, question, answer);
				result = {
					questionId: question.id,
					type: question.type,
					score,
					outOf: 1,
					isCorrect: score >= 0.75 ? true : score <= 0.35 ? false : null,
					feedback,
					strengths,
					improvements,
					yourAnswer: answer || null,
					correctAnswer: question.idealResponse,
				};
				break;
			}
			default:
				result = {
					questionId: question.id,
					type: question.type,
					score: 0,
					outOf: 1,
					isCorrect: false,
					feedback: "Question type not recognised for grading.",
					strengths: [],
					improvements: ["Please flag this item for review."],
					yourAnswer: null,
					correctAnswer: null,
				};
				break;
		}

		scores.push(result);
	}

	const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
	const totalPossible = scores.reduce((sum, item) => sum + item.outOf, 0);
	const overall = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

	const highlights = await summarizePerformance(
		lovableApiKey,
		exam.documentTitle,
		scores,
		exam.intensity,
	);

	const breakdown = scores.reduce<Array<{
		type: QuestionType;
		score: number;
		questions: number;
	}>>((acc, item) => {
		const bucket = acc.find((entry) => entry.type === item.type);
		if (bucket) {
			bucket.score += item.score;
			bucket.questions += 1;
		} else {
			acc.push({
				type: item.type,
				score: item.score,
				questions: 1,
			});
		}
		return acc;
	}, []).map((entry) => ({
		...entry,
		score: entry.questions > 0 ? (entry.score / entry.questions) * 100 : 0,
	}));

	const conceptScores = new Map<string, { score: number; attempts: number }>();
	const extractConcepts = (prompt: string) => {
		const tokens = prompt
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, "")
			.split(/\s+/)
			.filter((token) => token.length > 4)
			.slice(0, 3);
		return tokens.length > 0 ? tokens : ["general"];
	};

	scores.forEach((score) => {
		const question = exam.questions.find((item) => item.id === score.questionId);
		const concepts = question ? extractConcepts(question.prompt) : ["general"];
		concepts.forEach((concept) => {
			const entry = conceptScores.get(concept) ?? { score: 0, attempts: 0 };
			entry.score += score.score;
			entry.attempts += 1;
			conceptScores.set(concept, entry);
		});
	});

	const masteryHeatmap = Array.from(conceptScores.entries())
		.map(([concept, data]) => ({
			concept,
			score: data.attempts > 0 ? (data.score / data.attempts) * 100 : 0,
			attempts: data.attempts,
		}))
		.sort((a, b) => a.score - b.score);

	const reviewQueue = scores
		.filter((detail) => detail.isCorrect === false || detail.score < 0.7)
		.map((detail) => {
			const question = exam.questions.find((item) => item.id === detail.questionId);
			return {
				questionId: detail.questionId,
				prompt: question?.prompt ?? "Question prompt unavailable",
				yourAnswer: detail.yourAnswer,
				correctAnswer: detail.correctAnswer,
				rationale: detail.feedback,
				sources: question?.sources?.map((source) => ({
					excerpt: source.excerpt,
					label: source.label,
				})) ?? [],
				quickActions: ["retry", "flashcard", "note", "generateVariants"] as const,
			};
		});

	return {
		overallScore: Math.round(overall),
		details: scores,
		highlights,
		breakdownByType: breakdown,
		masteryHeatmap,
		reviewQueue,
	};
};

const mapTestRow = (row: TestRow) => ({
	id: row.id,
	title: row.title,
	description: row.description,
	intensity: row.intensity,
	timerEnabled: row.timer_enabled,
	timerMinutes: resolveTimerMinutes(row),
	questionPlan: row.question_plan,
	folderIds: row.folder_ids ?? [],
	documentIds: row.document_ids ?? [],
	status: row.status,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

const mapRunRow = (row: RunRow) => ({
	id: row.id,
	testId: row.test_id,
	status: row.status,
	questions: row.generated_exam?.questions ?? [],
	timer: row.generated_exam?.timer ?? { enabled: false, suggestedMinutes: 25 },
	startedAt: row.started_at ?? undefined,
	completedAt: row.completed_at ?? undefined,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}

	const accessToken = ensureAccessToken(req);
	if (!accessToken) {
		return jsonResponse(401, { error: "Unauthorized" });
	}

	const supabase = getSupabaseClient();

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser(accessToken);

	if (userError || !user) {
		return jsonResponse(401, { error: "Unauthorized" });
	}

	const role = await getRole(supabase, user.id);
	if (role === "guest") {
		return jsonResponse(403, {
			error: "Mock exams require an upgraded account",
			reason: "upgrade_required",
		});
	}

	const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
	if (!lovableApiKey) {
		console.error("Missing LOVABLE_API_KEY");
		return jsonResponse(500, { error: "Server not configured" });
	}

	const url = new URL(req.url);
	const path = normalizePath(url);
	const segments = path.split("/").filter(Boolean);

	if (segments.length === 0 || segments[0] !== "v1" || segments[1] !== "test") {
		return jsonResponse(404, { error: "Not found" });
	}

	const resourceSegments = segments.slice(2);
	const method = req.method.toUpperCase();

	try {
		// /v1/test
		if (resourceSegments.length === 0) {
			if (method === "GET") {
				const { data, error } = await supabase
					.from("test_arena_tests")
					.select("*")
					.eq("owner_id", user.id)
					.order("created_at", { ascending: false })
					.returns<TestRow[]>();

				if (error) {
					throw error;
				}

				return jsonResponse(200, {
					tests: data.map(mapTestRow),
				});
			}

			if (method === "POST") {
				const body = await req.json();
				const title = typeof body.title === "string" ? body.title.trim() : "";
				const description = typeof body.description === "string" ? body.description.trim() : null;
				const intensity = body.intensity as Intensity | undefined;
				const timerEnabled = Boolean(body.timerEnabled);
				const questionPlan = body.questionPlan as QuestionPlan | undefined;
				const folderIds = Array.isArray(body.folderIds) ? body.folderIds : [];
				const documentIds = Array.isArray(body.documentIds) ? body.documentIds : [];
				const planForTimer = questionPlan ?? {
					mcq: 0,
					fillInTheBlank: 0,
					matching: 0,
					essay: { count: 0, wordCount: 0 },
					shortAnswer: { count: 0, wordCount: 0 },
				};

				if (!title) {
					return jsonResponse(400, { error: "title is required" });
				}

				if (!intensity || !["light", "standard", "intense"].includes(intensity)) {
					return jsonResponse(400, { error: "Invalid intensity" });
				}

				if (!questionPlan) {
					return jsonResponse(400, { error: "questionPlan is required" });
				}

				if (countTotalQuestions(questionPlan) === 0) {
					return jsonResponse(400, { error: "Add at least one question to the plan" });
				}

				const timerMinutes = sanitizeTimerMinutes(
					body.timerMinutes,
					estimatePlanMinutes(planForTimer),
				);

				const { data, error } = await supabase
					.from("test_arena_tests")
					.insert({
						owner_id: user.id,
						title,
						description,
						intensity,
						timer_enabled: timerEnabled,
						question_plan: questionPlan,
						folder_ids: folderIds,
						document_ids: documentIds,
						status: "ready",
						config: composeTestConfig(
							null,
							timerEnabled,
							timerMinutes,
						),
					})
					.select("*")
					.single<TestRow>();

				if (error || !data) {
					throw error ?? new Error("Failed to create test");
				}

				return jsonResponse(201, { test: mapTestRow(data) });
			}

			return jsonResponse(405, { error: "Method not allowed" });
		}

		// /v1/test/:testId
		const testId = resourceSegments[0];
		const remaining = resourceSegments.slice(1);

		const { data: testRow, error: testError } = await supabase
			.from("test_arena_tests")
			.select("*")
			.eq("id", testId)
			.eq("owner_id", user.id)
			.maybeSingle<TestRow>();

		if (testError) {
			throw testError;
		}

		if (!testRow) {
			return jsonResponse(404, { error: "Test not found" });
		}

		if (remaining.length === 0) {
			if (method === "GET") {
				return jsonResponse(200, { test: mapTestRow(testRow) });
			}

			if (method === "PUT") {
				const body = await req.json();
				const updates: Record<string, unknown> = {};

				if (typeof body.title === "string") {
					const trimmed = body.title.trim();
					if (!trimmed) {
						return jsonResponse(400, { error: "title cannot be empty" });
					}
					updates.title = trimmed;
				}

				if (typeof body.description === "string") {
					updates.description = body.description.trim();
				}

				let configShouldUpdate = false;
				let nextTimerEnabled = testRow.timer_enabled;
				let nextTimerMinutes = resolveTimerMinutes(testRow);

				if (typeof body.timerEnabled === "boolean") {
					nextTimerEnabled = body.timerEnabled;
					updates.timer_enabled = body.timerEnabled;
					configShouldUpdate = true;
				}

				if (body.timerMinutes !== undefined) {
					nextTimerMinutes = sanitizeTimerMinutes(
						body.timerMinutes,
						nextTimerMinutes,
					);
					configShouldUpdate = true;
				}

				if (configShouldUpdate) {
					updates.config = composeTestConfig(
						testRow.config,
						nextTimerEnabled,
						nextTimerMinutes,
					);
				}

				if (body.questionPlan) {
					const plan = body.questionPlan as QuestionPlan;
					if (countTotalQuestions(plan) === 0) {
						return jsonResponse(400, { error: "Add at least one question to the plan" });
					}
					updates.question_plan = plan;
				}

				if (Array.isArray(body.folderIds)) {
					updates.folder_ids = body.folderIds;
				}

				if (Array.isArray(body.documentIds)) {
					updates.document_ids = body.documentIds;
				}

				if (typeof body.status === "string") {
					if (!["draft", "ready", "archived"].includes(body.status)) {
						return jsonResponse(400, { error: "Invalid status" });
					}
					updates.status = body.status;
				}

				if (Object.keys(updates).length === 0) {
					return jsonResponse(200, { test: mapTestRow(testRow) });
				}

				const { data, error } = await supabase
					.from("test_arena_tests")
					.update(updates)
					.eq("id", testId)
					.select("*")
					.single<TestRow>();

				if (error || !data) {
					throw error ?? new Error("Failed to update test");
				}

				return jsonResponse(200, { test: mapTestRow(data) });
			}

			if (method === "DELETE") {
				const { error } = await supabase
					.from("test_arena_tests")
					.delete()
					.eq("id", testId);

				if (error) {
					throw error;
				}

				return jsonResponse(204, {});
			}

			return jsonResponse(405, { error: "Method not allowed" });
		}

		// /v1/test/:testId/start
		if (remaining.length === 1 && remaining[0] === "start") {
			if (method !== "POST") {
				return jsonResponse(405, { error: "Method not allowed" });
			}

			const content = await aggregateDocumentContent(
				supabase,
				user.id,
				testRow.document_ids ?? [],
				testRow.folder_ids ?? [],
			);

			const exam = await generateExam(lovableApiKey, testRow, content);

			const { data, error } = await supabase
				.from("test_arena_runs")
				.insert({
					test_id: testRow.id,
					owner_id: user.id,
					status: "in_progress",
					generated_exam: exam,
					responses: [],
					created_at: new Date().toISOString(),
					started_at: new Date().toISOString(),
				})
				.select("*")
				.single<RunRow>();

			if (error || !data) {
				throw error ?? new Error("Failed to create test run");
			}

			return jsonResponse(200, {
				run: {
					id: data.id,
					testId: data.test_id,
					status: data.status,
					questions: exam.questions,
					timer: exam.timer,
					startedAt: data.started_at ?? undefined,
					completedAt: data.completed_at ?? undefined,
				},
			});
		}

		// /v1/test/:testId/runs
		if (remaining.length === 1 && remaining[0] === "runs") {
			if (method === "GET") {
				const { data, error } = await supabase
					.from("test_arena_runs")
					.select("*")
					.eq("test_id", testId)
					.eq("owner_id", user.id)
					.order("created_at", { ascending: false })
					.returns<RunRow[]>();

				if (error) {
					throw error;
				}

				return jsonResponse(200, {
					runs: data.map(mapRunRow),
				});
			}

			return jsonResponse(405, { error: "Method not allowed" });
		}

		// /v1/test/:testId/runs/:runId
		if (remaining.length >= 2 && remaining[0] === "runs") {
			const runId = remaining[1];
			const runPath = remaining.slice(2);

			const { data: runRow, error: runError } = await supabase
				.from("test_arena_runs")
				.select("*")
				.eq("id", runId)
				.eq("test_id", testId)
				.eq("owner_id", user.id)
				.maybeSingle<RunRow>();

			if (runError) {
				throw runError;
			}

			if (!runRow) {
				return jsonResponse(404, { error: "Run not found" });
			}

			if (runPath.length === 0) {
				if (method === "GET") {
					return jsonResponse(200, {
						run: mapRunRow(runRow),
						evaluation: runRow.evaluation,
						summary: runRow.summary,
					});
				}

				return jsonResponse(405, { error: "Method not allowed" });
			}

			if (runPath.length === 1 && runPath[0] === "submit") {
				if (method !== "POST") {
					return jsonResponse(405, { error: "Method not allowed" });
				}

				if (!runRow.generated_exam) {
					return jsonResponse(400, { error: "Run has no generated exam" });
				}

				const body = await req.json();
				const responses = Array.isArray(body.responses)
					? body.responses as MockExamResponse[]
					: [];

				const evaluation = await evaluateResponses(
					lovableApiKey,
					runRow.generated_exam,
					responses,
				);

				const summary: SummaryPayload = {
					overallScore: evaluation.overallScore,
					breakdownByType: evaluation.breakdownByType,
					masteryHeatmap: evaluation.masteryHeatmap,
				};

				const { data: updatedRun, error: updateError } = await supabase
					.from("test_arena_runs")
					.update({
						status: "completed",
						responses,
						evaluation,
						summary,
						completed_at: new Date().toISOString(),
					})
					.eq("id", runId)
					.select("*")
					.single<RunRow>();

				if (updateError || !updatedRun) {
					throw updateError ?? new Error("Failed to store run results");
				}

				return jsonResponse(200, {
					run: mapRunRow(updatedRun),
					evaluation,
					summary,
				});
			}

			return jsonResponse(404, { error: "Endpoint not found" });
		}

		return jsonResponse(404, { error: "Endpoint not found" });
	} catch (error) {
		console.error("Test API error:", error);
		const message =
			error instanceof Error
				? error.message || "Unknown error"
				: typeof error === "object" && error !== null && "message" in error
				? String((error as { message?: unknown }).message ?? "Unknown error")
				: "Unknown error";
		return jsonResponse(500, { error: message });
	}
});
